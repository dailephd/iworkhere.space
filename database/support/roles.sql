-- Least-privilege support roles. Run as the schema owner after 001-schema.sql with
--   psql -v database_name=<database> -f roles.sql
-- Do not put passwords into this file. Set each role password securely in Neon
-- after the grants, then store the resulting connection strings as server-only
-- environment variables (SUPPORT_DATABASE_URL, SUPPORT_WORKER_DATABASE_URL,
-- SUPPORT_DASHBOARD_DATABASE_URL). These roles are disjoint from the
-- observability writer and observability_dashboard roles.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'support_writer') THEN
        CREATE ROLE support_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'support_worker') THEN
        CREATE ROLE support_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'support_dashboard') THEN
        CREATE ROLE support_dashboard LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
    END IF;
END $$;
REVOKE ALL ON DATABASE :"database_name" FROM support_writer, support_worker, support_dashboard;
-- PostgreSQL gives PUBLIC TEMPORARY by default; remove it so the roles hold only CONNECT.
REVOKE TEMPORARY, CREATE ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO support_writer, support_worker, support_dashboard;
REVOKE ALL ON SCHEMA support FROM support_writer, support_worker, support_dashboard;
GRANT USAGE ON SCHEMA support TO support_writer, support_worker, support_dashboard;
REVOKE ALL ON ALL TABLES IN SCHEMA support FROM support_writer, support_worker, support_dashboard;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA support FROM support_writer, support_worker, support_dashboard;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA support FROM support_writer, support_worker, support_dashboard;
-- Intake: only the atomic submission function.
GRANT EXECUTE ON FUNCTION support.submit_report(text, uuid, text, text, text, text, text, text, text, text, text, boolean, integer, interval) TO support_writer;
-- Worker: queue operations, retention and authorized deletion only.
GRANT EXECUTE ON FUNCTION support.claim_jobs(integer, interval) TO support_worker;
GRANT EXECUTE ON FUNCTION support.job_payload(uuid, uuid) TO support_worker;
GRANT EXECUTE ON FUNCTION support.complete_job(uuid, uuid, text, integer, text) TO support_worker;
GRANT EXECUTE ON FUNCTION support.fail_job(uuid, uuid, text, boolean, integer) TO support_worker;
GRANT EXECUTE ON FUNCTION support.purge_expired(timestamptz, integer, integer) TO support_worker;
GRANT EXECUTE ON FUNCTION support.delete_report(text) TO support_worker;
-- Dashboard: SELECT on the three views only; no table, sequence or function access.
GRANT SELECT ON support.dashboard_report, support.dashboard_job, support.dashboard_health TO support_dashboard;
-- Future support functions are not callable by PUBLIC unless explicitly granted.
ALTER DEFAULT PRIVILEGES IN SCHEMA support REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
