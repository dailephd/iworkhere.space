-- Manual operator permission step, after 003. No embedded credentials.
-- Does not widen existing measurement, diagnostic or support grants.
BEGIN;
-- statement-break
CREATE ROLE observability_health_collector LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
-- statement-break
GRANT CONNECT ON DATABASE :"database_name" TO observability_health_collector;
-- statement-break
GRANT USAGE ON SCHEMA observability TO observability_health_collector;
-- statement-break
GRANT EXECUTE ON FUNCTION observability.begin_health_collection(uuid,timestamptz,timestamptz),
 observability.finish_health_collection(uuid,timestamptz,text,text,integer,text,jsonb,integer,integer,integer) TO observability_health_collector;
-- statement-break
ALTER ROLE observability_health_collector SET statement_timeout='15s';
-- statement-break
ALTER ROLE observability_health_collector SET idle_in_transaction_session_timeout='15s';
-- statement-break
GRANT EXECUTE ON FUNCTION observability.health_summary(timestamptz) TO observability_reporting;
-- statement-break
-- Existing dashboard role is optional in isolated fixtures.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='observability_dashboard') THEN
 GRANT EXECUTE ON FUNCTION observability.health_summary(timestamptz) TO observability_dashboard;
END IF; END $$;
-- statement-break
COMMIT;
-- statement-break
