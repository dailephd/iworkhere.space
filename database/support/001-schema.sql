-- Idempotent, support-only migration. It never touches the observability schema.
-- Statement separators are consumed by the support migration runner; function
-- bodies deliberately keep SQL semicolons.
CREATE SCHEMA IF NOT EXISTS support;
-- statement-break
REVOKE ALL ON SCHEMA support FROM PUBLIC;
-- statement-break
CREATE TABLE IF NOT EXISTS support.report (
    id text PRIMARY KEY CHECK (id ~ '^SR-[0-9A-HJKMNP-TV-Z]{16}$'),
    idempotency_key uuid NOT NULL UNIQUE,
    payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
    schema_version smallint NOT NULL CHECK (schema_version = 1),
    category text NOT NULL CHECK (category IN (
        'incorrect_result', 'tool_failure', 'invalid_output', 'interface_accessibility',
        'performance_compatibility', 'content_link', 'privacy_security', 'suggestion', 'other'
    )),
    area text NOT NULL CHECK (area IN ('tool', 'site-wide', 'other')),
    tool_id text CHECK (tool_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
    pathname text NOT NULL CHECK (pathname ~ '^/[a-zA-Z0-9/_-]*$' AND pathname !~ '^//' AND length(pathname) <= 256),
    description text CHECK (char_length(description) BETWEEN 1 AND 2000),
    expected text CHECK (char_length(expected) BETWEEN 1 AND 1000),
    observed text CHECK (char_length(observed) BETWEEN 1 AND 1000),
    contact_email text CHECK (char_length(contact_email) <= 254 AND contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    contact_consent boolean NOT NULL DEFAULT false,
    received_at timestamptz NOT NULL DEFAULT now(),
    tracker_issue_number integer CHECK (tracker_issue_number > 0),
    tracker_issue_url text CHECK (char_length(tracker_issue_url) <= 300 AND tracker_issue_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/issues/[0-9]+$'),
    last_correspondence_at timestamptz,
    narrative_purged_at timestamptz,
    contact_purged_at timestamptz,
    CHECK ((area = 'tool') = (tool_id IS NOT NULL)),
    CHECK (narrative_purged_at IS NOT NULL OR description IS NOT NULL),
    CHECK (contact_email IS NULL OR contact_consent),
    CHECK (NOT contact_consent OR contact_email IS NOT NULL OR contact_purged_at IS NOT NULL)
);
-- statement-break
CREATE INDEX IF NOT EXISTS report_received_at_idx ON support.report (received_at DESC);
-- statement-break
CREATE TABLE IF NOT EXISTS support.outbox_job (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id text NOT NULL REFERENCES support.report (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('github_issue', 'operator_email', 'contact_receipt')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'leased', 'delivered', 'dead')),
    attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 6),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    lease_token uuid,
    provider_ref text CHECK (char_length(provider_ref) <= 200),
    failure_code text CHECK (failure_code ~ '^[a-z0-9_]{1,40}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    UNIQUE (report_id, kind),
    CHECK ((status = 'leased') = (lease_until IS NOT NULL AND lease_token IS NOT NULL)),
    CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);
-- statement-break
CREATE INDEX IF NOT EXISTS outbox_job_due_idx ON support.outbox_job (status, next_attempt_at);
-- statement-break
-- Atomic intake: one statement-level transaction inserts the report and its
-- independent outbox jobs. Idempotent by key; same key + different digest conflicts.
CREATE OR REPLACE FUNCTION support.submit_report(
    p_id text, p_key uuid, p_digest text, p_category text, p_area text, p_tool_id text, p_pathname text,
    p_description text, p_expected text, p_observed text, p_email text, p_consent boolean,
    p_global_limit integer DEFAULT 120, p_window interval DEFAULT interval '10 minutes'
) RETURNS TABLE (outcome text, report_id text, received_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
DECLARE
    existing support.report%ROWTYPE;
    created support.report%ROWTYPE;
BEGIN
    SELECT * INTO existing FROM support.report r WHERE r.idempotency_key = p_key;
    IF FOUND THEN
        RETURN QUERY SELECT CASE WHEN existing.payload_digest = p_digest THEN 'replayed' ELSE 'conflict' END, existing.id, existing.received_at;
        RETURN;
    END IF;
    IF (SELECT count(*) FROM support.report r WHERE r.received_at > now() - p_window) >= p_global_limit THEN
        RETURN QUERY SELECT 'rate_limited'::text, NULL::text, NULL::timestamptz;
        RETURN;
    END IF;
    INSERT INTO support.report AS r (id, idempotency_key, payload_digest, schema_version, category, area, tool_id, pathname,
        description, expected, observed, contact_email, contact_consent)
    VALUES (p_id, p_key, p_digest, 1, p_category, p_area, p_tool_id, p_pathname,
        p_description, p_expected, p_observed, CASE WHEN p_consent THEN p_email END, p_consent)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING r.* INTO created;
    IF NOT FOUND THEN
        -- A concurrent request with the same key committed first.
        SELECT * INTO existing FROM support.report r WHERE r.idempotency_key = p_key;
        RETURN QUERY SELECT CASE WHEN existing.payload_digest = p_digest THEN 'replayed' ELSE 'conflict' END, existing.id, existing.received_at;
        RETURN;
    END IF;
    INSERT INTO support.outbox_job (report_id, kind) VALUES (created.id, 'github_issue'), (created.id, 'operator_email');
    IF created.contact_consent AND created.contact_email IS NOT NULL THEN
        INSERT INTO support.outbox_job (report_id, kind) VALUES (created.id, 'contact_receipt');
    END IF;
    RETURN QUERY SELECT 'created'::text, created.id, created.received_at;
END;
$$;
-- statement-break
-- Concurrency-safe claim: SKIP LOCKED plus a lease; expired leases are recoverable.
CREATE OR REPLACE FUNCTION support.claim_jobs(p_limit integer DEFAULT 10, p_lease interval DEFAULT interval '5 minutes')
RETURNS TABLE (job_id uuid, report_id text, kind text, attempt_count smallint, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
BEGIN
    UPDATE support.outbox_job j
    SET status = 'dead', failure_code = 'lease_expired', lease_until = NULL, lease_token = NULL, updated_at = now()
    WHERE j.status = 'leased' AND j.lease_until <= now() AND j.attempt_count >= 6;
    RETURN QUERY
    WITH due AS (
        SELECT o.id FROM support.outbox_job o
        WHERE (o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'leased' AND o.lease_until <= now())
        ORDER BY o.next_attempt_at, o.created_at
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE support.outbox_job j
    SET status = 'leased', attempt_count = j.attempt_count + 1, lease_until = now() + p_lease,
        lease_token = gen_random_uuid(), updated_at = now()
    FROM due
    WHERE j.id = due.id
    RETURNING j.id, j.report_id, j.kind, j.attempt_count, j.lease_token;
END;
$$;
-- statement-break
-- Minimal per-kind payload for the lease holder; the contact address is released
-- only for a consented contact receipt.
CREATE OR REPLACE FUNCTION support.job_payload(p_job uuid, p_token uuid)
RETURNS TABLE (report_id text, kind text, category text, area text, tool_id text, pathname text, received_at timestamptz, contact_email text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
    SELECT r.id, j.kind, r.category, r.area, r.tool_id, r.pathname, r.received_at,
        CASE WHEN j.kind = 'contact_receipt' AND r.contact_consent THEN r.contact_email END
    FROM support.outbox_job j JOIN support.report r ON r.id = j.report_id
    WHERE j.id = p_job AND j.status = 'leased' AND j.lease_token = p_token AND j.lease_until > now();
$$;
-- statement-break
CREATE OR REPLACE FUNCTION support.complete_job(p_job uuid, p_token uuid, p_provider_ref text DEFAULT NULL, p_issue_number integer DEFAULT NULL, p_issue_url text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
DECLARE
    done support.outbox_job%ROWTYPE;
BEGIN
    UPDATE support.outbox_job j
    SET status = 'delivered', delivered_at = now(), lease_until = NULL, lease_token = NULL, provider_ref = p_provider_ref,
        failure_code = NULL, updated_at = now()
    WHERE j.id = p_job AND j.status = 'leased' AND j.lease_token = p_token
    RETURNING j.* INTO done;
    IF NOT FOUND THEN RETURN false; END IF;
    IF done.kind = 'github_issue' AND p_issue_number IS NOT NULL THEN
        UPDATE support.report SET tracker_issue_number = p_issue_number, tracker_issue_url = p_issue_url WHERE id = done.report_id;
    END IF;
    IF done.kind = 'contact_receipt' THEN
        UPDATE support.report SET last_correspondence_at = now() WHERE id = done.report_id;
    END IF;
    RETURN true;
END;
$$;
-- statement-break
-- Bounded exponential backoff: 2, 4, 8, 16 then 30 minutes; dead after the max attempt.
CREATE OR REPLACE FUNCTION support.fail_job(p_job uuid, p_token uuid, p_code text, p_retryable boolean DEFAULT true, p_max_attempts integer DEFAULT 6)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
DECLARE
    failed support.outbox_job%ROWTYPE;
    next_status text;
BEGIN
    SELECT * INTO failed FROM support.outbox_job j WHERE j.id = p_job AND j.status = 'leased' AND j.lease_token = p_token FOR UPDATE;
    IF NOT FOUND THEN RETURN 'ignored'; END IF;
    next_status := CASE WHEN p_retryable AND failed.attempt_count < p_max_attempts THEN 'pending' ELSE 'dead' END;
    UPDATE support.outbox_job j
    SET status = next_status, failure_code = p_code, lease_until = NULL, lease_token = NULL, updated_at = now(),
        next_attempt_at = CASE WHEN next_status = 'pending'
            THEN now() + least(2 * power(2, failed.attempt_count - 1), 30) * interval '1 minute' ELSE j.next_attempt_at END
    WHERE j.id = p_job;
    RETURN next_status;
END;
$$;
-- statement-break
-- Retention capability. The worker invokes it only when SUPPORT_RETENTION_ENABLED=true.
CREATE OR REPLACE FUNCTION support.purge_expired(p_now timestamptz DEFAULT now(), p_narrative_days integer DEFAULT 180, p_contact_days integer DEFAULT 90)
RETURNS TABLE (narrative_purged integer, contact_purged integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
DECLARE
    n integer;
    c integer;
BEGIN
    WITH expired AS (
        UPDATE support.report r
        SET contact_email = NULL, contact_purged_at = p_now
        WHERE r.contact_email IS NOT NULL AND coalesce(r.last_correspondence_at, r.received_at) < p_now - make_interval(days => p_contact_days)
        RETURNING r.id
    ), stopped AS (
        UPDATE support.outbox_job j
        SET status = 'dead', failure_code = 'contact_purged', lease_until = NULL, lease_token = NULL, updated_at = now()
        FROM expired e
        WHERE j.report_id = e.id AND j.kind = 'contact_receipt' AND j.status IN ('pending', 'leased')
        RETURNING j.id
    )
    SELECT count(*) INTO c FROM expired;
    WITH expired AS (
        UPDATE support.report r
        SET description = NULL, expected = NULL, observed = NULL, narrative_purged_at = p_now
        WHERE r.narrative_purged_at IS NULL AND r.received_at < p_now - make_interval(days => p_narrative_days)
        RETURNING r.id
    )
    SELECT count(*) INTO n FROM expired;
    RETURN QUERY SELECT n, c;
END;
$$;
-- statement-break
-- Authorized deletion of one report and its jobs (operator-invoked through the worker role).
CREATE OR REPLACE FUNCTION support.delete_report(p_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, support AS $$
BEGIN
    DELETE FROM support.report WHERE id = p_id;
    RETURN FOUND;
END;
$$;
-- statement-break
REVOKE ALL ON FUNCTION support.submit_report(text, uuid, text, text, text, text, text, text, text, text, text, boolean, integer, interval) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.claim_jobs(integer, interval) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.job_payload(uuid, uuid) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.complete_job(uuid, uuid, text, integer, text) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.fail_job(uuid, uuid, text, boolean, integer) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.purge_expired(timestamptz, integer, integer) FROM PUBLIC;
-- statement-break
REVOKE ALL ON FUNCTION support.delete_report(text) FROM PUBLIC;
-- statement-break
-- Dashboard-facing views. The dashboard role reads only these (never the tables).
CREATE OR REPLACE VIEW support.dashboard_report AS
SELECT r.id, r.category, r.area, r.tool_id, r.pathname, r.received_at, r.description, r.expected, r.observed,
    CASE WHEN r.contact_consent THEN r.contact_email END AS contact_email,
    r.contact_consent, r.tracker_issue_url, r.narrative_purged_at, r.contact_purged_at,
    (SELECT count(*) FROM support.outbox_job j WHERE j.report_id = r.id AND j.status = 'dead') AS dead_job_count,
    (SELECT count(*) FROM support.outbox_job j WHERE j.report_id = r.id AND j.status <> 'delivered') AS undelivered_job_count
FROM support.report r;
-- statement-break
CREATE OR REPLACE VIEW support.dashboard_job AS
SELECT j.id, j.report_id, j.kind, j.status, j.attempt_count, j.next_attempt_at, j.failure_code, j.created_at, j.updated_at, j.delivered_at
FROM support.outbox_job j;
-- statement-break
CREATE OR REPLACE VIEW support.dashboard_health AS
SELECT
    count(*) FILTER (WHERE status IN ('pending', 'leased')) AS undelivered_count,
    count(*) FILTER (WHERE status = 'pending' AND attempt_count > 0) AS retrying_count,
    count(*) FILTER (WHERE status = 'dead') AS dead_count,
    count(*) FILTER (WHERE status <> 'delivered' AND attempt_count > 0) AS failing_count,
    min(created_at) FILTER (WHERE status IN ('pending', 'leased')) AS oldest_pending_at
FROM support.outbox_job;
-- statement-break
REVOKE ALL ON support.dashboard_report, support.dashboard_job, support.dashboard_health FROM PUBLIC;
