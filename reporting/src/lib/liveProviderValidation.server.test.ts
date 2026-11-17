import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { fixtureIssuer } from "../test/issuer";
import { STYTCH_LIVE_ISSUER } from "./stytchLive";
import { validateLiveProviderRequest } from "./liveProviderValidation.server";
let issuer: Awaited<ReturnType<typeof fixtureIssuer>>;
let localJwks: string, localIntrospection: string;
const sink = vi.fn();
beforeEach(async () => {
    sink.mockReset(); issuer = await fixtureIssuer("https://iworkhere-reporting.vercel.app/mcp");
    localJwks = issuer.config.jwks; localIntrospection = issuer.config.introspection;
    Object.assign(issuer.config, { issuer: STYTCH_LIVE_ISSUER, jwks: STYTCH_LIVE_ISSUER + "/.well-known/jwks.json", introspection: STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect", profile: "standard" });
    issuer.state.override = { aud: [issuer.config.clientId], client_id: issuer.config.clientId, token_type: "access_token" };
});
afterEach(async () => { await issuer.close(); });
const fetcher: typeof fetch = (input, init) => {
    const url = String(input);
    if (url === STYTCH_LIVE_ISSUER + "/.well-known/jwks.json") return fetch(localJwks, init);
    if (url === STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect") return fetch(localIntrospection, init);
    throw new Error("Unapproved provider endpoint");
};
async function validate(token: string, until = Date.now() + 5 * 60 * 1000) {
    return validateLiveProviderRequest(new Request(issuer.config.resource, { headers: { authorization: "Bearer " + token } }), issuer.config, until, fetcher, sink);
}
it("observes only signed enrolled operator facts and always denies reporting", async () => {
    const token = await issuer.sign({}, "JWT");
    const response = await validate(token);
    expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(issuer.state.calls).toBe(1); expect(issuer.state.authorization).toMatch(/^Basic /);
    expect(sink).toHaveBeenCalledWith({ event: "reporting_live_provider_validation", schemaVersion: 1, signedEnrolledOperator: true, tokenType: "JWT", algorithm: "ES256", introspectionHTTP200: true, active: true, subjectMatches: true, issuerMatches: true, clientMatches: true, audience: "client", accessTokenType: true, reportingScope: true, issuedAtShift: 0, expirationShift: 0, equalLifetime: true });
    const evidence = JSON.stringify(sink.mock.calls);
    for (const privateValue of [token, issuer.config.clientSecret, "enrolled-operator", issuer.config.clientId]) expect(evidence).not.toContain(privateValue);
});
it.each([{ iss: "https://wrong.example" }, { aud: "https://wrong.example/mcp" }, { exp: 1 }, { nbf: 4102444800 }, { sub: "not-enrolled" }, { scope: "other:read" }])("rejects invalid or unauthorized signed input without evidence %j", async claim => {
    expect((await validate(await issuer.sign(claim, "JWT"))).status).toBe(401);
    expect(sink).not.toHaveBeenCalled(); expect(issuer.state.calls).toBe(0);
});
it("does not record evidence for invalid signatures or oversized input", async () => {
    const key = await generateKeyPair("ES256");
    const token = await new SignJWT({ scope: "reporting:read" }).setProtectedHeader({ alg: "ES256", kid: "fixture-key-1", typ: "JWT" }).setIssuer(STYTCH_LIVE_ISSUER).setAudience(issuer.config.resource).setSubject("enrolled-operator").setIssuedAt().setExpirationTime("5m").sign(key.privateKey);
    expect((await validate(token)).status).toBe(401); expect((await validate("x".repeat(9000))).status).toBe(401);
    expect(sink).not.toHaveBeenCalled(); expect(issuer.state.calls).toBe(0);
});
it("projects untrusted introspection strings to fixed labels, never private values", async () => {
    const secret = "private-support@example.invalid/postgresql://private";
    issuer.state.override = { aud: secret, client_id: secret, sub: secret, iss: secret, token_type: secret, scope: secret, harmless: [{ support: secret, stack: secret }], exp: Infinity, iat: -1 };
    expect((await validate(await issuer.sign({}, "untrusted-header"))).status).toBe(401);
    expect(sink).toHaveBeenCalledOnce(); const evidence = sink.mock.calls[0][0];
    expect(evidence.tokenType).toBe("unsupported"); expect(evidence.audience).toBe("other"); expect(evidence.expirationShift).toBe("outside_bound");
    expect(JSON.stringify(evidence)).not.toMatch(/private-support|postgresql|stack|harmless|untrusted-header/);
});
it("observes active-state revocation on every request while never authorizing", async () => {
    const token = await issuer.sign({}, "JWT");
    expect((await validate(token)).status).toBe(401); issuer.state.active = false;
    expect((await validate(token)).status).toBe(401); expect(issuer.state.calls).toBe(2);
    expect(sink.mock.calls.map(call => call[0].active)).toEqual([true, false]);
});
it.each([NaN, Infinity, 1, Date.now() + 60 * 60 * 1000])("fails closed for invalid or expired validation deadline %s", async until => {
    expect((await validate("untrusted", until)).status).toBe(503); expect(sink).not.toHaveBeenCalled(); expect(issuer.state.calls).toBe(0);
});
it.each(["issuer", "jwks", "introspection", "resource", "profile"] as const)("requires exact pinned Live configuration for %s", async field => {
    Object.assign(issuer.config, { [field]: "https://other.example" });
    expect((await validate("untrusted")).status).toBe(503); expect(sink).not.toHaveBeenCalled();
});
it("fails safely for unavailable provider and never emits its error text", async () => {
    issuer.state.unavailable = true;
    const response = await validate(await issuer.sign({}, "JWT"));
    expect(response.status).toBe(401); expect(sink).not.toHaveBeenCalled(); expect(await response.text()).not.toMatch(/secret|fixture|postgres/);
});
it("bounds provider output and rejects provider timeouts without leaking diagnostics", async () => {
    const token = await issuer.sign({}, "JWT");
    issuer.state.override = { unexpected: "private".repeat(10000) };
    expect((await validate(token)).status).toBe(401); expect(sink).not.toHaveBeenCalled();
    const response = await validateLiveProviderRequest(new Request(issuer.config.resource, { headers: { authorization: "Bearer " + token } }), issuer.config, Date.now() + 60000, async () => { throw new DOMException("private-provider-secret", "TimeoutError"); }, sink);
    expect(response.status).toBe(401); expect(sink).not.toHaveBeenCalled(); expect(await response.text()).not.toContain("private-provider-secret");
});
it("refreshes signing keys without authorizing either the old or new token", async () => {
    const old = await issuer.sign({}, "JWT");
    expect((await validate(old)).status).toBe(401); expect(sink).toHaveBeenCalledOnce();
    await issuer.rotate(); sink.mockClear();
    expect((await validate(old)).status).toBe(401); expect(sink).not.toHaveBeenCalled();
    expect((await validate(await issuer.sign({}, "JWT"))).status).toBe(401); expect(sink).toHaveBeenCalledOnce();
});
