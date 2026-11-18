-- Additive operational metadata only. Never changes measurement history.
CREATE TABLE IF NOT EXISTS observability.health_epoch (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    activated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO observability.health_epoch(singleton) VALUES (true) ON CONFLICT DO NOTHING;
-- statement-break
CREATE TABLE IF NOT EXISTS observability.health_operation (
    attempt_id uuid NOT NULL,
    operation text NOT NULL CHECK (operation IN ('ingestion','maintenance')),
    status text NOT NULL CHECK (status IN ('attempt','success','failure')),
    started_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    request_status integer CHECK (request_status BETWEEN 100 AND 599),
    failure_category text GENERATED ALWAYS AS (CASE WHEN status='failure' THEN 'operation_unavailable' END) STORED,
    PRIMARY KEY(attempt_id,status),
    CHECK (recorded_at >= started_at AND recorded_at <= started_at + interval '2 minutes'),
    CHECK (status <> 'attempt' OR recorded_at = started_at)
);
CREATE INDEX IF NOT EXISTS health_operation_started ON observability.health_operation(started_at);
-- statement-break
CREATE TABLE IF NOT EXISTS observability.health_collection (
    run_id uuid NOT NULL,
    window_start timestamptz NOT NULL,
    window_end timestamptz NOT NULL,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz,
    outcome text NOT NULL DEFAULT 'started' CHECK (outcome IN ('started','complete','partial','failed')),
    reason text NOT NULL DEFAULT 'pending' CHECK (reason IN ('pending','none','source_unavailable','source_truncated','source_unreconciled','source_revised','invalid_record','delivery_failed')),
    request_count integer CHECK (request_count BETWEEN 0 AND 1000),
    independent_request_count integer CHECK (independent_request_count BETWEEN 0 AND 1000000),
    independent_ingestion_failed integer NOT NULL DEFAULT 0 CHECK (independent_ingestion_failed BETWEEN 0 AND 1000000),
    independent_maintenance_failed integer NOT NULL DEFAULT 0 CHECK (independent_maintenance_failed BETWEEN 0 AND 1000000),
    fingerprint text CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    record_digest text CHECK (record_digest ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY(run_id,window_start),
    CHECK (window_end=window_start+interval '5 minutes'),
    CHECK ((outcome='started')=(completed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS health_collection_window ON observability.health_collection(window_start, completed_at DESC);
-- statement-break
CREATE OR REPLACE FUNCTION observability.begin_health_collection(run uuid, first_at timestamptz, last_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
    IF last_at <> first_at+interval '5 minutes' OR last_at>clock_timestamp()-interval '1 minute'
       OR first_at<clock_timestamp()-interval '1 hour' OR mod(extract(epoch FROM first_at),300)<>0 THEN RAISE EXCEPTION 'Invalid collection window'; END IF;
    INSERT INTO observability.health_collection(run_id,window_start,window_end) VALUES(run,first_at,last_at)
      ON CONFLICT DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM observability.health_collection WHERE run_id=run AND window_start=first_at AND window_end=last_at) THEN RAISE EXCEPTION 'Conflicting checkpoint'; END IF;
END $$;
-- statement-break
CREATE OR REPLACE FUNCTION observability.finish_health_collection(run uuid, first_at timestamptz, final_outcome text,
    final_reason text, total_requests integer, digest text, records jsonb, independent_count integer DEFAULT NULL, independent_failed integer DEFAULT 0, maintenance_failed integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE item jsonb; identity uuid; op text; phase text; began timestamptz; ended timestamptz; http integer; prior observability.health_operation%ROWTYPE; checkpoint observability.health_collection%ROWTYPE;
BEGIN
    PERFORM pg_advisory_xact_lock(731804222);
    SELECT * INTO checkpoint FROM observability.health_collection WHERE run_id=run AND window_start=first_at FOR UPDATE;
    IF NOT FOUND OR final_outcome NOT IN ('complete','partial','failed') OR final_reason NOT IN ('none','source_unavailable','source_truncated','source_unreconciled','source_revised','invalid_record','delivery_failed')
       OR records IS NULL OR jsonb_typeof(records)<>'array' OR jsonb_array_length(records)>2000 OR total_requests IS NULL OR total_requests NOT BETWEEN 0 AND 1000
       OR (digest IS NOT NULL AND digest !~ '^[a-f0-9]{64}$') OR independent_failed IS NULL OR maintenance_failed IS NULL OR independent_failed<0 OR maintenance_failed<0
       OR (independent_count IS NOT NULL AND (independent_count NOT BETWEEN 0 AND 1000000 OR independent_failed+maintenance_failed>independent_count))
       OR (final_outcome='complete' AND (final_reason<>'none' OR digest IS NULL OR independent_count IS NULL OR independent_count<>total_requests)) THEN RAISE EXCEPTION 'Invalid collection result'; END IF;
    IF checkpoint.outcome<>'started' THEN
        IF checkpoint.outcome=final_outcome AND checkpoint.reason=final_reason AND checkpoint.request_count=total_requests AND checkpoint.fingerprint IS NOT DISTINCT FROM digest AND checkpoint.independent_request_count IS NOT DISTINCT FROM independent_count AND checkpoint.independent_ingestion_failed=independent_failed AND checkpoint.independent_maintenance_failed=maintenance_failed AND checkpoint.record_digest=encode(sha256(convert_to(records::text,'UTF8')),'hex') THEN RETURN; END IF;
        RAISE EXCEPTION 'Conflicting collection result';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(records) LOOP
        IF jsonb_typeof(item)<>'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(item) key)
            <> ARRAY['attemptId','httpStatus','operation','schemaVersion','source','startedAt','status','timestamp']::text[]
            OR item->>'source' IS DISTINCT FROM 'observability-health' OR item->'schemaVersion' IS DISTINCT FROM '1'::jsonb
            OR EXISTS(SELECT 1 FROM jsonb_each(item) field WHERE field.key NOT IN ('schemaVersion','httpStatus') AND jsonb_typeof(field.value)<>'string')
            OR jsonb_typeof(item->'httpStatus') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid operation record'; END IF;
        identity:=(item->>'attemptId')::uuid; op:=item->>'operation'; phase:=item->>'status';
        began:=(item->>'startedAt')::timestamptz; ended:=(item->>'timestamp')::timestamptz; http:=(item->>'httpStatus')::integer;
        IF began<checkpoint.window_start OR began>=checkpoint.window_end OR ended>clock_timestamp() OR ended<clock_timestamp()-interval '7 days'
           OR http NOT BETWEEN 100 AND 599 OR (phase='success' AND http<>204) OR (phase='failure' AND http<>503) THEN RAISE EXCEPTION 'Invalid operation bounds'; END IF;
        IF EXISTS(SELECT 1 FROM observability.health_operation WHERE attempt_id=identity AND (operation<>op OR started_at<>began)) THEN RAISE EXCEPTION 'Conflicting operation identity'; END IF;
        IF phase IN ('success','failure') AND EXISTS(SELECT 1 FROM observability.health_operation WHERE attempt_id=identity AND status IN ('success','failure') AND status<>phase) THEN RAISE EXCEPTION 'Contradictory operation'; END IF;
        SELECT * INTO prior FROM observability.health_operation WHERE attempt_id=identity AND status=phase;
        IF FOUND THEN
            IF prior.operation<>op OR prior.started_at<>began OR prior.recorded_at<>ended OR prior.request_status<>http THEN RAISE EXCEPTION 'Conflicting duplicate'; END IF;
        ELSE
            INSERT INTO observability.health_operation(attempt_id,operation,status,started_at,recorded_at,request_status) VALUES(identity,op,phase,began,ended,http);
        END IF;
    END LOOP;
    IF (SELECT count(DISTINCT attempt_id) FROM observability.health_operation WHERE started_at>=checkpoint.window_start AND started_at<checkpoint.window_end AND attempt_id IN (SELECT (value->>'attemptId')::uuid FROM jsonb_array_elements(records)))>total_requests
       OR EXISTS(SELECT 1 FROM observability.health_operation terminal WHERE terminal.attempt_id IN (SELECT (value->>'attemptId')::uuid FROM jsonb_array_elements(records)) AND terminal.status<>'attempt' AND NOT EXISTS(SELECT 1 FROM observability.health_operation a WHERE a.attempt_id=terminal.attempt_id AND a.status='attempt')) THEN RAISE EXCEPTION 'Unreconciled operation records'; END IF;
    UPDATE observability.health_collection SET record_digest=encode(sha256(convert_to(records::text,'UTF8')),'hex'),outcome=final_outcome,reason=final_reason,request_count=total_requests,fingerprint=digest,independent_request_count=independent_count,independent_ingestion_failed=independent_failed,independent_maintenance_failed=maintenance_failed,completed_at=clock_timestamp()
      WHERE run_id=run AND window_start=first_at;
    DELETE FROM observability.health_operation WHERE started_at<clock_timestamp()-interval '7 days';
    DELETE FROM observability.health_collection WHERE window_end<clock_timestamp()-interval '7 days';
END $$;
-- statement-break
-- Only windows whose latest observation agrees with a separate earlier query
-- can establish coverage. A changed or failed latest observation revokes it.
CREATE OR REPLACE VIEW observability.health_verified_window AS
SELECT latest.window_start,latest.window_end FROM (
    SELECT DISTINCT ON(window_start) * FROM observability.health_collection
    ORDER BY window_start,started_at DESC,run_id
) latest CROSS JOIN observability.health_epoch epoch
WHERE latest.outcome='complete' AND latest.independent_request_count=latest.request_count AND latest.window_start>=epoch.activated_at
AND EXISTS(SELECT 1 FROM observability.health_collection earlier WHERE earlier.window_start=latest.window_start
    AND earlier.run_id<>latest.run_id AND earlier.outcome='complete' AND earlier.fingerprint=latest.fingerprint
    AND earlier.request_count=latest.request_count AND earlier.completed_at<=latest.started_at-interval '5 minutes'
    AND NOT EXISTS(SELECT 1 FROM observability.health_collection changed WHERE changed.window_start=latest.window_start
        AND changed.started_at>earlier.started_at AND changed.started_at<latest.started_at
        AND (changed.outcome<>'complete' OR changed.fingerprint IS DISTINCT FROM latest.fingerprint)));
-- statement-break
CREATE OR REPLACE FUNCTION observability.health_summary(report_at timestamptz)
RETURNS TABLE(observed_at timestamptz,coverage text,attempted bigint,accepted bigint,failed bigint,unresolved bigint,cron text,retained_from timestamptz,last_collected_at timestamptz,missing_interval_count bigint,failed_collection_count bigint,maximum_delivery_seconds numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
#variable_conflict use_column
BEGIN
IF report_at IS NULL OR report_at>statement_timestamp()+interval '30 seconds' OR report_at<statement_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Invalid health clock'; END IF;
RETURN QUERY
WITH tip AS (
 SELECT coalesce((SELECT max(v.window_end) FROM observability.health_verified_window v WHERE v.window_end BETWEEN report_at-interval '30 minutes' AND report_at),
 (SELECT max(c.window_end) FROM observability.health_collection c WHERE c.outcome IN ('complete','partial') AND c.window_end BETWEEN report_at-interval '30 minutes' AND report_at),report_at) AS cutoff
), clock AS (
 SELECT CASE WHEN EXISTS(SELECT 1 FROM observability.health_collection c WHERE c.completed_at IS NOT NULL AND c.window_end>tip.cutoff AND c.independent_ingestion_failed+c.independent_maintenance_failed>0)
 OR EXISTS(SELECT 1 FROM observability.health_operation o WHERE o.status='failure' AND o.recorded_at>tip.cutoff AND o.recorded_at<=report_at)
 OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(window_start) * FROM observability.health_collection ORDER BY window_start,started_at DESC,run_id) c
 WHERE c.window_end>=tip.cutoff AND (c.outcome IN ('failed','partial') OR (c.outcome='started' AND c.started_at<report_at-interval '8 minutes')))
 THEN report_at ELSE tip.cutoff END AS observed_at,
 greatest(activated_at,statement_timestamp()-interval '7 days') AS retained_from FROM observability.health_epoch CROSS JOIN tip
), coverage AS (
 SELECT coalesce(range_agg(tstzrange(window_start,window_end,'[)')),'{}'::tstzmultirange) AS covered FROM observability.health_verified_window
), bounds AS (
 SELECT clock.*, coverage.covered, tstzrange(observed_at-interval '24 hours',observed_at,'[)') AS expected,
 CASE WHEN observed_at >= (date_trunc('day',observed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+interval '3 hours 15 minutes'
 THEN (date_trunc('day',observed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')+interval '2 hours 15 minutes'
 ELSE (date_trunc('day',observed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 day'+interval '2 hours 15 minutes' END AS due
 FROM clock CROSS JOIN coverage
), operation AS (
 SELECT attempt_id,operation,started_at,bool_or(status='attempt') AS attempted,
 bool_or(status='success') AS accepted,bool_or(status='failure') AS failed,max(request_status) AS http
 FROM observability.health_operation,bounds WHERE started_at>=observed_at-interval '24 hours' AND started_at<observed_at AND recorded_at<observed_at
 GROUP BY attempt_id,operation,started_at
), independent_failure AS (
 SELECT coalesce(sum(ingestion),0)::bigint AS ingestion,coalesce(sum(maintenance),0)::bigint AS maintenance FROM (
 SELECT c.window_start,max(c.independent_ingestion_failed) AS ingestion,max(c.independent_maintenance_failed) AS maintenance
 FROM observability.health_collection c CROSS JOIN bounds WHERE c.completed_at IS NOT NULL AND c.window_start>=bounds.observed_at-interval '24 hours' AND c.window_end+interval '2 minutes'<=bounds.observed_at GROUP BY c.window_start) grouped
), totals AS (
 SELECT count(*) FILTER(WHERE operation='ingestion') AS attempted,
 count(*) FILTER(WHERE operation='ingestion' AND accepted) AS accepted,
 count(*) FILTER(WHERE operation='ingestion' AND failed) AS failed,
 count(*) FILTER(WHERE operation='ingestion' AND attempted AND NOT accepted AND NOT failed AND http IN (500,502,504)
   AND started_at<=observed_at-interval '15 seconds' AND covered @> tstzrange(started_at,started_at+interval '15 seconds','[)')) AS unresolved
 FROM operation CROSS JOIN bounds
), maintenance AS (
 SELECT operation.* FROM operation CROSS JOIN bounds WHERE operation='maintenance' AND started_at>=due ORDER BY started_at DESC LIMIT 1
)
SELECT bounds.observed_at,
 CASE WHEN NOT EXISTS(SELECT 1 FROM observability.health_collection WHERE completed_at>=report_at-interval '30 minutes') THEN 'unavailable'
 WHEN retained_from<=observed_at-interval '24 hours' AND covered @> expected THEN 'complete' ELSE 'partial' END AS coverage,
 greatest(totals.attempted,totals.accepted+greatest(totals.failed,independent_failure.ingestion)+totals.unresolved) AS attempted,totals.accepted,greatest(totals.failed,independent_failure.ingestion) AS failed,totals.unresolved,
 CASE WHEN independent_failure.maintenance>0 THEN 'failed' WHEN (SELECT accepted FROM maintenance) THEN 'succeeded' WHEN (SELECT failed FROM maintenance) THEN 'failed'
 WHEN EXISTS(SELECT 1 FROM maintenance WHERE attempted AND http>=500 AND started_at<=bounds.observed_at-interval '75 seconds'
   AND covered @> tstzrange(started_at,started_at+interval '75 seconds','[)')) THEN 'failed'
 WHEN EXISTS(SELECT 1 FROM maintenance) THEN 'unknown'
 WHEN covered @> expected AND due>=observed_at-interval '24 hours' THEN 'delayed' ELSE 'unknown' END AS cron,
 retained_from,
 (SELECT max(completed_at) FROM observability.health_collection) AS last_collected_at,
 (SELECT count(*) FROM unnest(tstzmultirange(expected)-covered)) AS missing_interval_count,
 (SELECT count(*) FROM observability.health_collection WHERE window_end>bounds.observed_at-interval '24 hours'
  AND (outcome IN ('failed','partial') OR (outcome='started' AND started_at<report_at-interval '8 minutes'))) AS failed_collection_count,
 coalesce((SELECT max(greatest(0,ceil(extract(epoch FROM (received_at-recorded_at))))) FROM observability.health_operation
 WHERE started_at>=bounds.observed_at-interval '24 hours' AND started_at<bounds.observed_at),0) AS maximum_delivery_seconds
FROM bounds CROSS JOIN totals CROSS JOIN independent_failure;
END $$;
-- statement-break
REVOKE ALL ON observability.health_epoch,observability.health_operation,observability.health_collection,observability.health_verified_window FROM PUBLIC;
REVOKE ALL ON FUNCTION observability.begin_health_collection(uuid,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION observability.finish_health_collection(uuid,timestamptz,text,text,integer,text,jsonb,integer,integer,integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION observability.health_summary(timestamptz) FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='observability_dashboard') THEN
    REVOKE ALL ON observability.health_epoch,observability.health_operation,observability.health_collection,observability.health_verified_window FROM observability_dashboard;
END IF; END $$;
