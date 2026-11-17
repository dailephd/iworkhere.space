import "server-only";
import { OAuthError, requireBearerAuth } from "@modelcontextprotocol/server";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { type AuthConfig, REQUIRED_SCOPE } from "./auth.server";
import { boundedBytes, safeResponse } from "./response";
import { STYTCH_LIVE_ISSUER } from "./stytchLive";

/** Fixed evidence projection: no identity, token, URL, arbitrary string or raw claims. */
export interface LiveProviderEvidence {
    event: "reporting_live_provider_validation";
    schemaVersion: 1;
    signedEnrolledOperator: true;
    tokenType: "JWT" | "at+jwt" | "unsupported";
    algorithm: "RS256" | "ES256";
    introspectionHTTP200: boolean;
    active: boolean;
    subjectMatches: boolean;
    issuerMatches: boolean;
    clientMatches: boolean;
    audience: "client" | "resource" | "other";
    accessTokenType: boolean;
    reportingScope: boolean;
    issuedAtShift: number | "outside_bound";
    expirationShift: number | "outside_bound";
    equalLifetime: boolean;
}

/** A preactivation probe, never an authorization profile or acceptance fallback. */
export async function validateLiveProviderRequest(request: Request, config: AuthConfig, until: number,
    fetcher: typeof fetch = fetch,
    sink: (evidence: LiveProviderEvidence) => void = evidence => { process.stdout.write(JSON.stringify(evidence) + "\n"); }): Promise<Response> {
    const now = Date.now();
    if (!Number.isSafeInteger(until) || until <= now || until - now > 15 * 60 * 1000
        || config.issuer !== STYTCH_LIVE_ISSUER || config.profile !== "standard"
        || config.resource !== "https://iworkhere-reporting.vercel.app/mcp"
        || config.jwks !== STYTCH_LIVE_ISSUER + "/.well-known/jwks.json"
        || config.introspection !== STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect") return safeResponse(503, "configuration_unavailable");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
    const safeFetch: typeof fetch = async (input, init) => {
        const response = await fetcher(input, { ...init, cache: "no-store", redirect: "error", signal });
        return new Response(await boundedBytes(response, 32 * 1024), { status: response.status, headers: response.headers });
    };
    const keys = createRemoteJWKSet(new URL(config.jwks), { cacheMaxAge: 0, cooldownDuration: 0, timeoutDuration: 5000, [customFetch]: safeFetch });
    const gate = requireBearerAuth({ requiredScopes: [REQUIRED_SCOPE], expectedResource: new URL(config.resource), resourceMetadataUrl: config.metadataUrl, verifier: {
        async verifyAccessToken(token) {
            try {
                if (token.length > 8192) throw new Error("size");
                // Omitting typ here observes the signed header only. This path
                // always rejects access; it cannot relax the real auth profile.
                const { payload, protectedHeader } = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.resource, algorithms: ["RS256", "ES256"], requiredClaims: ["iss", "aud", "sub", "exp", "iat"] });
                if (typeof payload.sub !== "string" || !config.subject.includes(payload.sub)
                    || !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat)
                    || typeof payload.scope !== "string" || !payload.scope.split(" ").includes(REQUIRED_SCOPE)) throw new Error("operator");
                const encode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
                const response = await safeFetch(config.introspection, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(encode(config.clientId) + ":" + encode(config.clientSecret)).toString("base64") }, body: new URLSearchParams({ token, token_type_hint: "access_token" }) });
                const value: unknown = await response.json();
                if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("shape");
                const current = value as Record<string, unknown>, audience = Array.isArray(current.aud) ? current.aud : [current.aud];
                function shift(value: unknown, signed: unknown): number | "outside_bound" {
                    return typeof value === "number" && Number.isSafeInteger(value) && typeof signed === "number" && Math.abs(value - signed) <= 2 ? value - signed : "outside_bound";
                }
                sink({ event: "reporting_live_provider_validation", schemaVersion: 1, signedEnrolledOperator: true,
                    tokenType: protectedHeader.typ === "JWT" || protectedHeader.typ === "at+jwt" ? protectedHeader.typ : "unsupported", algorithm: protectedHeader.alg as "RS256" | "ES256",
                    introspectionHTTP200: response.status === 200, active: current.active === true,
                    subjectMatches: current.sub === payload.sub, issuerMatches: current.iss === config.issuer,
                    clientMatches: current.client_id === config.clientId,
                    audience: audience.length === 1 && audience[0] === config.clientId ? "client" : audience.length === 1 && audience[0] === config.resource ? "resource" : "other",
                    accessTokenType: current.token_type === "access_token", reportingScope: typeof current.scope === "string" && current.scope.split(" ").includes(REQUIRED_SCOPE),
                    issuedAtShift: shift(current.iat, payload.iat), expirationShift: shift(current.exp, payload.exp),
                    equalLifetime: typeof current.iat === "number" && typeof current.exp === "number" && typeof payload.iat === "number" && typeof payload.exp === "number" && current.exp - current.iat === payload.exp - payload.iat });
            } catch { /* No raw provider errors or claims leave this boundary. */ }
            throw new OAuthError("invalid_token", "Reporting authorization is not activated");
        },
    } });
    const result = await gate(request);
    if (result instanceof Response) { result.headers.set("Cache-Control", "no-store"); return result; }
    return safeResponse(403, "access_denied");
}
