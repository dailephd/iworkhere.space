import { afterEach, beforeEach, expect, it } from "vitest";
import { decodeJwt, generateKeyPair, SignJWT } from "jose";
import { authConfig, authenticationGate, STYTCH_TEST_ISSUER } from "./auth.server";
import { STYTCH_LIVE_ISSUER } from "./stytchLive";
import { fixtureIssuer } from "../test/issuer";
const resource = "https://iworkhere-reporting.vercel.app/mcp";
let issuer: Awaited<ReturnType<typeof fixtureIssuer>>;
let localJwks: string, localIntrospection: string;
beforeEach(async () => {
    issuer = await fixtureIssuer(resource, "RS256"); localJwks = issuer.config.jwks; localIntrospection = issuer.config.introspection;
    Object.assign(issuer.config, { issuer: STYTCH_LIVE_ISSUER, jwks: STYTCH_LIVE_ISSUER + "/.well-known/jwks.json", introspection: STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect", profile: "stytch-live" });
    issuer.state.override = { aud: [issuer.config.clientId], client_id: issuer.config.clientId, token_type: "access_token" };
});
afterEach(async () => { await issuer.close(); });
const fetcher: typeof fetch = (input, init) => {
    if (String(input) === STYTCH_LIVE_ISSUER + "/.well-known/jwks.json") return fetch(localJwks, init);
    if (String(input) === STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect") return fetch(localIntrospection, init);
    throw new Error("Unapproved endpoint");
};
async function status(token: string) {
    const result = await authenticationGate(issuer.config, fetcher)(new Request(resource, { headers: { authorization: "Bearer " + token } }));
    return result instanceof Response ? result.status : 200;
}
function environment(): NodeJS.ProcessEnv {
    return { NODE_ENV: "production", VERCEL_ENV: "production", REPORTING_RESOURCE_URL: resource, REPORTING_OAUTH_ISSUER: STYTCH_LIVE_ISSUER, REPORTING_OAUTH_JWKS_URL: STYTCH_LIVE_ISSUER + "/.well-known/jwks.json", REPORTING_OAUTH_INTROSPECTION_URL: STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect", REPORTING_OAUTH_PROFILE: "stytch-live", REPORTING_INTROSPECTION_CLIENT_ID: "fixture-reader", REPORTING_INTROSPECTION_CLIENT_SECRET: "fixture-secret", REPORTING_ALLOWED_SUBJECTS: '["enrolled-operator"]' };
}
it("accepts the observed Live JWT only with exact resource, enrolled subject and active client-bound introspection", async () => {
    expect(authConfig(environment()).profile).toBe("stytch-live");
    expect(await status(await issuer.sign({}, "JWT"))).toBe(200); expect(issuer.state.calls).toBe(1);
    expect(issuer.state.authorization).toBe("Basic " + Buffer.from(issuer.config.clientId + ":" + issuer.config.clientSecret).toString("base64"));
});
it.each([0, 1])("accepts observed equal-lifetime forward shift %s and enforces fresh introspection", async shift => {
    const token = await issuer.sign({}, "JWT"), claims = decodeJwt(token);
    issuer.state.override = { ...issuer.state.override, iat: claims.iat! + shift, exp: claims.exp! + shift };
    expect(await status(token)).toBe(200); issuer.state.active = false;
    expect(await status(token)).toBe(401); expect(issuer.state.calls).toBe(2);
});
it.each([-1, 2])("rejects unobserved timestamp shift %s", async shift => {
    const token = await issuer.sign({}, "JWT"), claims = decodeJwt(token);
    issuer.state.override = { ...issuer.state.override, iat: claims.iat! + shift, exp: claims.exp! + shift };
    expect(await status(token)).toBe(401);
});
it("rejects changed lifetimes and expired signed tokens despite a later current expiry", async () => {
    const token = await issuer.sign({}, "JWT"), claims = decodeJwt(token);
    issuer.state.override = { ...issuer.state.override, iat: claims.iat, exp: claims.exp! + 1 };
    expect(await status(token)).toBe(401);
    issuer.state.override = { ...issuer.state.override, exp: Math.floor(Date.now() / 1000) + 300 };
    expect(await status(await issuer.sign({ exp: 1 }, "JWT"))).toBe(401);
});
it.each([{ iss: STYTCH_TEST_ISSUER }, { iss: "https://other.example" }, { aud: "https://other.example/mcp" }, { exp: 1 }, { nbf: 4102444800 }])("rejects invalid signed claim %j", async claim => {
    expect(await status(await issuer.sign(claim, "JWT"))).toBe(401); expect(issuer.state.calls).toBe(0);
});
it.each([-1, 1.5, 4102444800])("rejects unsafe signed issued-at timestamp %s", async iat => {
    expect(await status(await issuer.sign({ iat }, "JWT"))).toBe(401); expect(issuer.state.calls).toBe(0);
});
it.each(["at+jwt", "id+jwt", "jwt", "other"])("rejects unobserved Live JWT header %s", async typ => {
    expect(await status(await issuer.sign({}, typ))).toBe(401); expect(issuer.state.calls).toBe(0);
});
it("keeps scope and explicit enrollment mandatory", async () => {
    expect(await status(await issuer.sign({ scope: "other:read" }, "JWT"))).toBe(403);
    issuer.state.scope = "other:read"; expect(await status(await issuer.sign({}, "JWT"))).toBe(403);
    issuer.state.scope = "reporting:read"; expect(await status(await issuer.sign({ sub: "not-enrolled" }, "JWT"))).toBe(403);
});
it.each([{ token_type: "id_token" }, { token_type: undefined }, { client_id: "other-client" }, { aud: resource }, { aud: ["fixture-reader", "other-client"] }, { sub: "other-subject" }, { iss: STYTCH_TEST_ISSUER }, { active: false }])("rejects mismatched introspection %j", async override => {
    issuer.state.override = { ...issuer.state.override, ...override }; expect(await status(await issuer.sign({}, "JWT"))).toBe(401);
});
it("rejects invalid signatures and refreshed retired keys", async () => {
    const key = await generateKeyPair("RS256");
    const forged = await new SignJWT({ scope: "reporting:read" }).setProtectedHeader({ alg: "RS256", kid: "fixture-key-1", typ: "JWT" }).setIssuer(STYTCH_LIVE_ISSUER).setAudience(resource).setSubject("enrolled-operator").setIssuedAt().setExpirationTime("5m").sign(key.privateKey);
    expect(await status(forged)).toBe(401);
    const old = await issuer.sign({}, "JWT"); expect(await status(old)).toBe(200); await issuer.rotate();
    expect(await status(old)).toBe(401); expect(await status(await issuer.sign({}, "JWT"))).toBe(200);
});
it.each([{ VERCEL_ENV: "preview" }, { REPORTING_RESOURCE_URL: "https://other.example/mcp" }, { REPORTING_OAUTH_ISSUER: STYTCH_TEST_ISSUER }, { REPORTING_OAUTH_JWKS_URL: "https://other.example/jwks" }, { REPORTING_OAUTH_INTROSPECTION_URL: "https://other.example/introspect" }, { REPORTING_INTROSPECTION_CREDENTIAL_SLOT: "next" }, { REPORTING_ALLOWED_SUBJECTS: "[]" }])("pins all Live configuration boundaries %j", override => {
    expect(() => authConfig({ ...environment(), ...override })).toThrow("configuration");
});
it("does not make JWT headers acceptable to the standard profile", async () => {
    issuer.config.profile = "standard"; expect(await status(await issuer.sign({}, "JWT"))).toBe(401);
});
it.each(["issuer", "jwks", "introspection", "resource"] as const)("also pins injected Live gate configuration for %s", async field => {
    Object.assign(issuer.config, { [field]: "https://other.example/mcp" });
    expect(await status(await issuer.sign({}, "JWT"))).toBe(401); expect(issuer.state.calls).toBe(0);
});
it("rejects unobserved ES256 even when it is published by the trusted fixture JWKS", async () => {
    const es = await fixtureIssuer(resource, "ES256");
    try {
        localJwks = es.config.jwks; localIntrospection = es.config.introspection;
        expect(await status(await es.sign({ iss: STYTCH_LIVE_ISSUER }, "JWT"))).toBe(401); expect(es.state.calls).toBe(0);
    } finally { await es.close(); }
});
