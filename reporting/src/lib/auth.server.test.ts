import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { authenticationGate, authConfig, protectedResourceMetadata, resourceConfig } from "./auth.server";
import { fixtureIssuer } from "../test/issuer";
let issuer: Awaited<ReturnType<typeof fixtureIssuer>>;
beforeEach(async () => { issuer = await fixtureIssuer(); });
afterEach(async () => { await issuer.close(); vi.unstubAllEnvs(); });
async function authorize(token?: string) {
    return authenticationGate(issuer.config)(new Request(issuer.config.resource, { headers: token ? { Authorization: "Bearer " + token } : {} }));
}
async function status(token?: string) { const result = await authorize(token); return result instanceof Response ? result.status : 200; }
describe("OAuth resource authentication and live operator authorization", () => {
    it("requires bearer token, scope and advertised discovery challenge", async () => {
        const result = await authorize(); expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
        expect((result as Response).headers.get("www-authenticate")).toContain(issuer.config.metadataUrl);
        expect((result as Response).headers.get("www-authenticate")).toContain("reporting:read");
        expect(issuer.state.calls).toBe(0);
    });
    it("accepts enrolled operator only after JWT and active introspection", async () => {
        expect(await status(await issuer.sign())).toBe(200); expect(issuer.state.calls).toBe(1);
        expect(issuer.state.authorization).toContain("Basic ");
    });
    it("rejects invalid signature even with valid kid and claims", async () => {
        const key = await generateKeyPair("ES256");
        const token = await new SignJWT({ scope: "reporting:read" }).setProtectedHeader({ alg: "ES256", kid: "fixture-key-1", typ: "at+jwt" }).setIssuer(issuer.config.issuer).setAudience(issuer.config.resource).setSubject("enrolled-operator").setIssuedAt().setExpirationTime("5m").sign(key.privateKey);
        expect(await status(token)).toBe(401); expect(issuer.state.calls).toBe(0);
    });
    it.each([{ iss: "https://wrong-issuer.example" }, { aud: "https://wrong-resource.example/mcp" }, { exp: 1 }, { nbf: 4102444800 }])("rejects invalid claims %j", async claim => { expect(await status(await issuer.sign(claim))).toBe(401); expect(issuer.state.calls).toBe(0); });
    it("rejects missing scope in signed or current authorization claims", async () => {
        expect(await status(await issuer.sign({ scope: "other:read" }))).toBe(403);
        issuer.state.scope = "other:read"; expect(await status(await issuer.sign())).toBe(403);
    });
    it("rejects a valid token belonging to an unenrolled subject", async () => expect(await status(await issuer.sign({ sub: "not-enrolled" }))).toBe(403));
    it("does not cache successful authorization or revoked active state", async () => {
        const token = await issuer.sign(); expect(await status(token)).toBe(200);
        issuer.state.active = false; expect(await status(token)).toBe(401); expect(issuer.state.calls).toBe(2);
    });
    it("refreshes trusted keys and rejects retired keys without stale cache", async () => {
        const old = await issuer.sign(); expect(await status(old)).toBe(200);
        await issuer.rotate(); expect(await status(old)).toBe(401); expect(await status(await issuer.sign())).toBe(200);
    });
    it("fails closed on inaccessible provider, malformed bearer, cookies and oversized tokens", async () => {
        issuer.state.unavailable = true; expect(await status(await issuer.sign())).toBe(401);
        expect(await status("x".repeat(10000))).toBe(401);
        const result = await authenticationGate(issuer.config)(new Request(issuer.config.resource, { headers: { Cookie: "access_token=private" } }));
        expect((result as Response).status).toBe(401);
    });
    it("requires complete private configuration and HTTPS outside local tests", () => {
        expect(() => authConfig({ NODE_ENV: "test" })).toThrow("configuration");
        expect(() => resourceConfig({ NODE_ENV: "production", REPORTING_RESOURCE_URL: "http://127.0.0.1/mcp", REPORTING_OAUTH_ISSUER: "https://issuer.example" })).toThrow("configuration");
        expect(() => authConfig({ NODE_ENV: "production", REPORTING_RESOURCE_URL: "https://reporting.example/mcp", REPORTING_OAUTH_ISSUER: "https://issuer.example", REPORTING_ALLOWED_SUBJECTS: "[]" })).toThrow("configuration");
    });
    it("public discovery metadata contains no private configuration", () => {
        expect(protectedResourceMetadata(issuer.config)).toEqual({ resource: issuer.config.resource, authorization_servers: [issuer.config.issuer], scopes_supported: ["reporting:read"], bearer_methods_supported: ["header"] });
        expect(JSON.stringify(protectedResourceMetadata(issuer.config))).not.toMatch(/secret|enrolled|password|introspect|jwks/);
    });
});

it("binds introspection to signed claims and rejects mismatched active state", async () => {
    for (const override of [{ sub: "another-operator" }, { iss: "https://wrong.example" }, { aud: "https://wrong.example/mcp" }, { exp: 1 }, { nbf: 4102444800 }]) {
        issuer.state.override = override; expect(await status(await issuer.sign())).toBe(401);
    }
});
it("withdraws enrolled operator access without trusting a previously accepted token", async () => {
    const token = await issuer.sign(); expect(await status(token)).toBe(200);
    issuer.config.subject = []; expect(await status(token)).toBe(403);
});
it("loads exact complete provider-neutral configuration and rejects bad enrollment", () => {
    const env = { NODE_ENV: "production" as const, REPORTING_RESOURCE_URL: "https://reporting.example/mcp", REPORTING_OAUTH_ISSUER: "https://issuer.example", REPORTING_OAUTH_JWKS_URL: "https://issuer.example/jwks", REPORTING_OAUTH_INTROSPECTION_URL: "https://issuer.example/introspect", REPORTING_INTROSPECTION_CLIENT_ID: "reader", REPORTING_INTROSPECTION_CLIENT_SECRET: "synthetic-private", REPORTING_ALLOWED_SUBJECTS: '["immutable-subject"]' };
    expect(authConfig(env).subject).toEqual(["immutable-subject"]);
    expect(() => authConfig({ ...env, REPORTING_ALLOWED_SUBJECTS: "[]" })).toThrow("configuration");
    expect(() => authConfig({ ...env, REPORTING_OAUTH_JWKS_URL: "https://user:pass@issuer.example/jwks" })).toThrow("configuration");
});

it("uses RFC form encoding for introspection client_secret_basic credentials", async () => {
    issuer.config.clientId = "reader: id"; issuer.config.clientSecret = "!:# +";
    expect(await status(await issuer.sign())).toBe(200);
    expect(Buffer.from(issuer.state.authorization.slice(6), "base64").toString()).toBe("reader%3A+id:%21%3A%23+%2B");
});
