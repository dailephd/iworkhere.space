-- Operator-reviewed template, separate from schema migration.
-- Run as database administrator in the ONE dedicated observability database.
-- psql: \set database_name 'your_database_name'
-- Do not put a password into this file. Set it securely in Neon after grants.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'observability_dashboard') THEN
        CREATE ROLE observability_dashboard LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
    END IF;
END $$;
REVOKE ALL ON DATABASE :"database_name" FROM observability_dashboard;
-- PostgreSQL defaults give PUBLIC TEMPORARY. Remove that inherited privilege
-- in this dedicated database so the dashboard truly has only CONNECT.
REVOKE TEMPORARY, CREATE ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO observability_dashboard;
REVOKE ALL ON SCHEMA observability FROM observability_dashboard;
GRANT USAGE ON SCHEMA observability TO observability_dashboard;
REVOKE ALL ON ALL TABLES IN SCHEMA observability FROM observability_dashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA observability TO observability_dashboard;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA observability FROM observability_dashboard;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA observability FROM observability_dashboard;
-- Execute as the same owner that will run future migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA observability GRANT SELECT ON TABLES TO observability_dashboard;
ALTER DEFAULT PRIVILEGES IN SCHEMA observability REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
