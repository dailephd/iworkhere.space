import { afterEach, expect, it, vi } from "vitest";
import { reportingRequest, validateReportingResponse } from "../../../dashboard/src/lib/reportingModel";
import { authConfig, STYTCH_TEST_ISSUER } from "./auth.server";
import { FIXTURE_NOTICE, observePreviewFixture, previewFixtureEnabled } from "./previewFixture.server";
import { reportResult } from "./response";

const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production", VERCEL_ENV: "preview", REPORTING_PREVIEW_FIXTURE: "true",
    REPORTING_RESOURCE_URL: "https://preview.example/mcp", REPORTING_OAUTH_ISSUER: STYTCH_TEST_ISSUER,
    REPORTING_OAUTH_PROFILE: "stytch-test", REPORTING_OAUTH_JWKS_URL: STYTCH_TEST_ISSUER + "/.well-known/jwks.json",
    REPORTING_OAUTH_INTROSPECTION_URL: STYTCH_TEST_ISSUER + "/v1/oauth2/introspect",
    REPORTING_INTROSPECTION_CLIENT_ID: "fixture-client", REPORTING_INTROSPECTION_CLIENT_SECRET: "old-fixture-secret",
    REPORTING_INTROSPECTION_CLIENT_SECRET_NEXT: "next-fixture-secret", REPORTING_ALLOWED_SUBJECTS: '["enrolled-operator"]',
};
afterEach(() => vi.unstubAllEnvs());
function configure() { for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value); vi.stubEnv("REPORTING_DATABASE_URL", undefined); }

it("requires explicit Preview fixture opt-in", () => {
    expect(previewFixtureEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(previewFixtureEnabled(env)).toBe(true);
});
it.each([
    { REPORTING_PREVIEW_FIXTURE: "false" }, { VERCEL_ENV: "production" }, { VERCEL_ENV: undefined },
    { REPORTING_OAUTH_PROFILE: "standard" }, { REPORTING_OAUTH_ISSUER: "https://other.example" },
    { REPORTING_RESOURCE_URL: "https://iworkhere-reporting.vercel.app/mcp" }, { REPORTING_DATABASE_URL: "postgresql://fixture.invalid" },
])("rejects mixed or non-Test fixture configuration %j", override => {
    expect(() => previewFixtureEnabled({ ...env, ...override })).toThrow("configuration");
});
it.each(["24h", "7d", "30d", "90d", "180d", "1y", "all"])("projects bounded synthetic aggregates through B1 for %s", async range => {
    configure(); const input = reportingRequest({ schemaVersion: 1, range });
    const dto = validateReportingResponse(await observePreviewFixture(input));
    expect(dto.navigationCount).toBe(12); expect(dto.toolOpenCount).toBe(3); expect(dto.toolExecutionCount).toBe(2);
    expect(dto.health.state).toBe("INSUFFICIENT_EVIDENCE"); expect(dto.vital[0].name).toBe("LCP");
    expect(dto.vital[0].statistic).toBe(["180d", "1y", "all"].includes(range) ? "typical_daily_p75" : "range_p75");
    expect(Buffer.byteLength(JSON.stringify(reportResult(dto)))).toBeLessThan(65536);
    expect(FIXTURE_NOTICE).toContain("Not production");
});
it("rejects fixture invocation without opt-in and rejects unknown input properties", async () => {
    vi.stubEnv("REPORTING_PREVIEW_FIXTURE", undefined);
    await expect(observePreviewFixture({ schemaVersion: 1, range: "24h" })).rejects.toThrow("configuration");
    configure(); await expect(observePreviewFixture({ schemaVersion: 1, range: "24h", sql: "SELECT secret" })).rejects.toThrow();
});
it("retains the current credential and selects next only for explicit Test fixture Preview", () => {
    expect(authConfig(env).clientSecret).toBe("old-fixture-secret");
    expect(authConfig({ ...env, REPORTING_INTROSPECTION_CREDENTIAL_SLOT: "next" }).clientSecret).toBe("next-fixture-secret");
    for (const override of [{ REPORTING_INTROSPECTION_CREDENTIAL_SLOT: "unknown" }, { REPORTING_INTROSPECTION_CLIENT_SECRET_NEXT: "" }, { REPORTING_PREVIEW_FIXTURE: undefined }, { REPORTING_DATABASE_URL: "postgresql://fixture.invalid" }, { VERCEL_ENV: "production" }, { REPORTING_OAUTH_PROFILE: "standard" }]) {
        expect(() => authConfig({ ...env, REPORTING_INTROSPECTION_CREDENTIAL_SLOT: "next", ...override })).toThrow("configuration");
    }
    expect(env.REPORTING_INTROSPECTION_CLIENT_SECRET).toBe("old-fixture-secret");
});
