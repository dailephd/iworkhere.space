-- Idempotent, observability-only migration. Statement separators are consumed by
-- the Neon migration runner; function bodies deliberately keep SQL semicolons.
CREATE SCHEMA IF NOT EXISTS observability;
-- statement-break
REVOKE ALL ON SCHEMA observability FROM PUBLIC;
-- statement-break
CREATE TABLE IF NOT EXISTS observability.event (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    received_at timestamptz NOT NULL DEFAULT now(),
    kind text NOT NULL CHECK (kind IN ('navigation', 'analytic-event', 'web-vital', 'client-error')),
    pathname text NOT NULL CHECK (pathname ~ '^/[a-zA-Z0-9/_-]*$' AND pathname !~ '^//' AND length(pathname) <= 256),
    tool_id text CHECK (tool_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
    event_name text CHECK (event_name IN ('tool_opened', 'tool_executed', 'tool_result_copied', 'tool_mode_changed')),
    metric_name text CHECK (metric_name IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID')),
    metric_value double precision CHECK (metric_value >= 0 AND metric_value < 'Infinity'::double precision),
    metric_rating text CHECK (metric_rating IN ('good', 'needs-improvement', 'poor')),
    failure_category text CHECK (failure_category IN ('window-error', 'unhandled-rejection', 'tool-render-error', 'unknown')),
    device_class text NOT NULL DEFAULT 'unknown' CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown')),
    referrer_host text CHECK (length(referrer_host) <= 253 AND referrer_host ~ '^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$'),
    navigation_type text CHECK (navigation_type IN ('initial', 'push', 'replace', 'traverse', 'navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore')),
    CHECK (occurred_at = received_at),
    CHECK ((
        (kind = 'navigation' AND tool_id IS NULL AND event_name IS NULL AND metric_name IS NULL AND metric_value IS NULL AND metric_rating IS NULL AND failure_category IS NULL AND navigation_type IN ('initial', 'push', 'replace', 'traverse')) OR
        (kind = 'analytic-event' AND tool_id IS NOT NULL AND event_name IS NOT NULL AND metric_name IS NULL AND metric_value IS NULL AND metric_rating IS NULL AND failure_category IS NULL AND referrer_host IS NULL AND navigation_type IS NULL) OR
        (kind = 'web-vital' AND tool_id IS NULL AND event_name IS NULL AND metric_name IS NOT NULL AND metric_value IS NOT NULL AND failure_category IS NULL AND referrer_host IS NULL) OR
        (kind = 'client-error' AND failure_category IS NOT NULL AND event_name IS NULL AND metric_name IS NULL AND metric_value IS NULL AND metric_rating IS NULL AND referrer_host IS NULL AND navigation_type IS NULL)
    ) IS TRUE)
);
-- statement-break
CREATE INDEX IF NOT EXISTS event_occurred_at_idx ON observability.event (occurred_at);
-- statement-break
CREATE INDEX IF NOT EXISTS event_kind_occurred_at_idx ON observability.event (kind, occurred_at);
-- statement-break
CREATE INDEX IF NOT EXISTS event_tool_occurred_at_idx ON observability.event (tool_id, occurred_at);
-- statement-break
CREATE INDEX IF NOT EXISTS event_path_occurred_at_idx ON observability.event (pathname, occurred_at);
-- statement-break
CREATE INDEX IF NOT EXISTS event_metric_occurred_at_idx ON observability.event (metric_name, occurred_at);
-- statement-break
CREATE TABLE IF NOT EXISTS observability.daily_event (
    day date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('navigation', 'analytic-event', 'client-error')),
    pathname text NOT NULL,
    tool_id text NOT NULL DEFAULT '',
    event_name text NOT NULL DEFAULT '',
    failure_category text NOT NULL DEFAULT '',
    device_class text NOT NULL CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown')),
    -- Preserve navigation-host breakdown for long ranges without raw referrers.
    referrer_host text NOT NULL DEFAULT '',
    count bigint NOT NULL CHECK (count > 0),
    PRIMARY KEY (day, kind, pathname, tool_id, event_name, failure_category, device_class, referrer_host)
);
-- statement-break
CREATE TABLE IF NOT EXISTS observability.daily_vital (
    day date NOT NULL,
    pathname text NOT NULL,
    metric_name text NOT NULL CHECK (metric_name IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID')),
    device_class text NOT NULL CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown')),
    sample_count bigint NOT NULL CHECK (sample_count > 0),
    p50 double precision NOT NULL CHECK (p50 >= 0 AND p50 < 'Infinity'::double precision),
    p75 double precision NOT NULL CHECK (p75 >= p50 AND p75 < 'Infinity'::double precision),
    p95 double precision NOT NULL CHECK (p95 >= p75 AND p95 < 'Infinity'::double precision),
    PRIMARY KEY (day, pathname, metric_name, device_class)
);
-- statement-break
CREATE TABLE IF NOT EXISTS observability.rollup_day (
    day date PRIMARY KEY,
    completed_at timestamptz NOT NULL DEFAULT now()
);
-- statement-break
CREATE OR REPLACE FUNCTION observability.rollup_complete_day(target_day date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    day_start timestamptz := target_day::timestamp AT TIME ZONE 'UTC';
    day_end timestamptz := (target_day + 1)::timestamp AT TIME ZONE 'UTC';
BEGIN
    PERFORM pg_advisory_xact_lock(731804221);
    IF target_day IS NULL OR target_day >= (now() AT TIME ZONE 'UTC')::date THEN
        RAISE EXCEPTION 'Only complete UTC days can be rolled up';
    END IF;
    -- Never replace historical aggregates from already-pruned partial raw data.
    IF target_day < (now() AT TIME ZONE 'UTC')::date - 3
       AND EXISTS (SELECT 1 FROM observability.rollup_day WHERE day = target_day) THEN
        RETURN;
    END IF;
    DELETE FROM observability.daily_event WHERE day = target_day;
    INSERT INTO observability.daily_event (day, kind, pathname, tool_id, event_name, failure_category, device_class, referrer_host, count)
    SELECT target_day, kind, pathname, coalesce(tool_id, ''), coalesce(event_name, ''), coalesce(failure_category, ''), device_class, coalesce(referrer_host, ''), count(*)
    FROM observability.event
    WHERE occurred_at >= day_start AND occurred_at < day_end AND kind <> 'web-vital'
    GROUP BY kind, pathname, tool_id, event_name, failure_category, device_class, referrer_host;

    DELETE FROM observability.daily_vital WHERE day = target_day;
    INSERT INTO observability.daily_vital (day, pathname, metric_name, device_class, sample_count, p50, p75, p95)
    SELECT target_day, pathname, metric_name, device_class, count(*),
        percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value),
        percentile_cont(0.75) WITHIN GROUP (ORDER BY metric_value),
        percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)
    FROM observability.event
    WHERE occurred_at >= day_start AND occurred_at < day_end AND kind = 'web-vital'
    GROUP BY pathname, metric_name, device_class;

    INSERT INTO observability.rollup_day (day, completed_at) VALUES (target_day, now())
    ON CONFLICT (day) DO UPDATE SET completed_at = EXCLUDED.completed_at;
END;
$$;
-- statement-break
CREATE OR REPLACE FUNCTION observability.prune_raw()
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE deleted_count bigint;
BEGIN
    PERFORM pg_advisory_xact_lock(731804221);
    DELETE FROM observability.event e
    WHERE e.occurred_at < now() - interval '90 days'
      AND EXISTS (SELECT 1 FROM observability.rollup_day r WHERE r.day = (e.occurred_at AT TIME ZONE 'UTC')::date);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
-- statement-break
CREATE OR REPLACE FUNCTION observability.maintain()
RETURNS TABLE (rolled_day_count bigint, deleted_event_count bigint)
LANGUAGE plpgsql AS $$
DECLARE target_day date;
BEGIN
    PERFORM pg_advisory_xact_lock(731804221);
    rolled_day_count := 0;
    FOR target_day IN
        SELECT DISTINCT (e.occurred_at AT TIME ZONE 'UTC')::date
        FROM observability.event e
        LEFT JOIN observability.rollup_day r ON r.day = (e.occurred_at AT TIME ZONE 'UTC')::date
        WHERE e.occurred_at < date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND (r.day IS NULL OR r.day >= (now() AT TIME ZONE 'UTC')::date - 3)
        ORDER BY 1
    LOOP
        PERFORM observability.rollup_complete_day(target_day);
        rolled_day_count := rolled_day_count + 1;
    END LOOP;
    deleted_event_count := observability.prune_raw();
    RETURN NEXT;
END;
$$;
-- statement-break
REVOKE ALL ON ALL TABLES IN SCHEMA observability FROM PUBLIC;
-- statement-break
REVOKE ALL ON ALL SEQUENCES IN SCHEMA observability FROM PUBLIC;
-- statement-break
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA observability FROM PUBLIC;
