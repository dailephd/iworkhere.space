-- Additive diagnostic storage; never writes the metric stream.
CREATE TABLE IF NOT EXISTS observability.error_diagnostic (
    id uuid PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now(),
    reported_at timestamptz,
    origin text NOT NULL CHECK (origin IN ('client', 'server')),
    severity text NOT NULL CHECK (severity IN ('warn', 'error')),
    error_name text NOT NULL CHECK (octet_length(error_name) <= 256),
    message text NOT NULL CHECK (octet_length(message) <= 4096),
    stack text CHECK (octet_length(stack) <= 24576),
    cause jsonb,
    error_detail jsonb NOT NULL CHECK (jsonb_typeof(error_detail) = 'object' AND octet_length(error_detail::text) <= 65536),
    component_stack text CHECK (octet_length(component_stack) <= 16384),
    pathname text NOT NULL CHECK (pathname ~ '^/[a-zA-Z0-9/_-]*$' AND length(pathname) <= 256),
    tool_id text CHECK (tool_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
    boundary text CHECK (length(boundary) <= 128),
    failure_category text NOT NULL CHECK (failure_category ~ '^[a-zA-Z0-9_-]{1,128}$'),
    fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    client_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(client_context) = 'object' AND octet_length(client_context::text) <= 24576),
    server_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(server_context) = 'object' AND octet_length(server_context::text) <= 4096),
    deployment_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(deployment_context) = 'object' AND octet_length(deployment_context::text) <= 2048)
);
-- statement-break
CREATE INDEX IF NOT EXISTS error_diagnostic_received_idx ON observability.error_diagnostic (received_at DESC, id DESC);
-- statement-break
CREATE INDEX IF NOT EXISTS error_diagnostic_fingerprint_time_idx ON observability.error_diagnostic (fingerprint, received_at DESC);
-- statement-break
CREATE INDEX IF NOT EXISTS error_diagnostic_pathname_time_idx ON observability.error_diagnostic (pathname, received_at DESC);
-- statement-break
CREATE INDEX IF NOT EXISTS error_diagnostic_tool_time_idx ON observability.error_diagnostic (tool_id, received_at DESC) WHERE tool_id IS NOT NULL;
-- statement-break
CREATE OR REPLACE FUNCTION observability.prune_diagnostics(reference_time timestamptz DEFAULT now())
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE deleted_count bigint;
BEGIN
    IF reference_time IS NULL THEN RAISE EXCEPTION 'Diagnostic retention requires a reference time'; END IF;
    DELETE FROM observability.error_diagnostic WHERE received_at < reference_time - interval '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
-- statement-break
REVOKE ALL ON observability.error_diagnostic FROM PUBLIC;
-- statement-break
REVOKE EXECUTE ON FUNCTION observability.prune_diagnostics(timestamptz) FROM PUBLIC;
