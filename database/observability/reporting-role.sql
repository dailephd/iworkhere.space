-- Operator-reviewed, MANUAL template. Not a migration and never run at startup.
-- Use psql as the owner of the existing dedicated observability database:
-- \set database_name 'your_database_name'
-- No password in source. Provision LOGIN credentials in the provider secret store.
-- Intentionally refuses an existing role: audit it separately instead of silently
-- retaining memberships, column grants or ownership. Transaction rolls back on any
-- failed effective-privilege assertion. Do not change PUBLIC grants implicitly.
BEGIN;
CREATE ROLE observability_reporting LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOREPLICATION NOINHERIT NOBYPASSRLS;
REVOKE ALL ON DATABASE :"database_name" FROM observability_reporting;
GRANT CONNECT ON DATABASE :"database_name" TO observability_reporting;
GRANT USAGE ON SCHEMA observability TO observability_reporting;
GRANT SELECT (occurred_at, received_at, kind, pathname, tool_id, event_name,
    failure_category, metric_name, metric_value, device_class)
    ON observability.event TO observability_reporting;
GRANT SELECT (day, kind, pathname, tool_id, event_name, failure_category, count)
    ON observability.daily_event TO observability_reporting;
GRANT SELECT (day, metric_name, sample_count, p75)
    ON observability.daily_vital TO observability_reporting;
GRANT SELECT (day) ON observability.rollup_day TO observability_reporting;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA observability FROM observability_reporting;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA observability FROM observability_reporting;
ALTER ROLE observability_reporting SET default_transaction_read_only = on;
ALTER ROLE observability_reporting SET statement_timeout = '15s';
ALTER ROLE observability_reporting SET idle_in_transaction_session_timeout = '15s';
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
        WHERE r.rolname = 'observability_reporting') THEN
        RAISE EXCEPTION 'Reporting role membership requires separate review';
    END IF;
    IF has_database_privilege('observability_reporting', current_database(), 'CREATE')
       OR has_database_privilege('observability_reporting', current_database(), 'TEMP')
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE has_schema_privilege('observability_reporting', oid, 'CREATE')) THEN
        RAISE EXCEPTION 'PUBLIC database/schema privileges must be restricted by the operator first';
    END IF;
    IF to_regnamespace('support') IS NOT NULL AND
       has_schema_privilege('observability_reporting', 'support', 'USAGE') THEN
        RAISE EXCEPTION 'Reporting role must have no support schema access';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r', 'v', 'm', 'p')
        AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT (n.nspname = 'observability' AND c.relname IN ('event', 'daily_event', 'daily_vital', 'rollup_day'))
        AND has_column_privilege('observability_reporting', c.oid, a.attnum, 'SELECT')) THEN
        RAISE EXCEPTION 'Unexpected reporting read privileges';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r', 'v', 'm', 'p')
        AND (has_table_privilege('observability_reporting', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR pg_get_userbyid(c.relowner) = 'observability_reporting')) THEN
        RAISE EXCEPTION 'Reporting role must not write or own data';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'observability' AND a.attnum > 0 AND NOT a.attisdropped
        AND CASE c.relname
            WHEN 'event' THEN a.attname NOT IN ('occurred_at','received_at','kind','pathname','tool_id','event_name','failure_category','metric_name','metric_value','device_class')
            WHEN 'daily_event' THEN a.attname NOT IN ('day','kind','pathname','tool_id','event_name','failure_category','count')
            WHEN 'daily_vital' THEN a.attname NOT IN ('day','metric_name','sample_count','p75')
            WHEN 'rollup_day' THEN a.attname <> 'day' ELSE false END
        AND has_column_privilege('observability_reporting', c.oid, a.attnum, 'SELECT')) THEN
        RAISE EXCEPTION 'Unexpected reporting column privileges';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        AND CASE WHEN c.relkind = 'S' THEN has_sequence_privilege('observability_reporting', c.oid, 'USAGE,SELECT,UPDATE') ELSE false END) THEN
        RAISE EXCEPTION 'Unexpected reporting sequence privileges';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        AND has_function_privilege('observability_reporting', p.oid, 'EXECUTE')) THEN
        RAISE EXCEPTION 'Reporting role must not execute domain functions';
    END IF;
END $$;
COMMIT;
-- Post-provisioning: independently inspect effective memberships, PUBLIC/default
-- grants, every column, functions, sequences and ownership. Verify forbidden writes
-- and diagnostic/support reads against an isolated database, never production data.
-- This role is column-limited; only the fixed service query/DTO boundary makes
-- returned data aggregate-only. Never hand the credential to ChatGPT or a client.
