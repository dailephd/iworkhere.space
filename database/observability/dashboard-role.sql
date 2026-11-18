-- Operator-reviewed template, separate from schema migration.
-- Run as database administrator in the ONE dedicated observability database.
-- psql: \set database_name 'your_database_name'
-- Do not put a password into this file. Set it securely in Neon after grants.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'observability_dashboard') THEN
        CREATE ROLE observability_dashboard LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
    END IF;
END $$;
-- statement-break
REVOKE ALL ON DATABASE :"database_name" FROM observability_dashboard;
-- statement-break
-- PostgreSQL defaults give PUBLIC TEMPORARY. Remove that inherited privilege
-- in this dedicated database so the dashboard truly has only CONNECT.
REVOKE TEMPORARY, CREATE ON DATABASE :"database_name" FROM PUBLIC;
-- statement-break
GRANT CONNECT ON DATABASE :"database_name" TO observability_dashboard;
-- statement-break
REVOKE ALL ON SCHEMA observability FROM observability_dashboard;
-- statement-break
GRANT USAGE ON SCHEMA observability TO observability_dashboard;
-- statement-break
REVOKE ALL ON ALL TABLES IN SCHEMA observability FROM observability_dashboard;
-- statement-break
GRANT SELECT ON observability.event,observability.daily_event,observability.daily_vital,
    observability.rollup_day,observability.error_diagnostic TO observability_dashboard;
-- statement-break
REVOKE ALL ON ALL SEQUENCES IN SCHEMA observability FROM observability_dashboard;
-- statement-break
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA observability FROM observability_dashboard;
-- statement-break
-- Execute as the same owner that will run future migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA observability REVOKE SELECT ON TABLES FROM observability_dashboard;
-- statement-break
ALTER DEFAULT PRIVILEGES IN SCHEMA observability REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- statement-break
DO $$ BEGIN IF to_regprocedure('observability.health_summary(timestamptz)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION observability.health_summary(timestamptz) TO observability_dashboard;
END IF; END $$;
-- statement-break
