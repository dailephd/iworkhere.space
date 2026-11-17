import "server-only";
import { OAuthError, requireBearerAuth, type AuthInfo } from "@modelcontextprotocol/server";
import { createRemoteJWKSet, customFetch, decodeProtectedHeader, jwtVerify } from "jose";
import { boundedBytes, safeResponse, ServiceUnavailable } from "./response";
import { STYTCH_LIVE_ISSUER } from "./stytchLive";

export const REQUIRED_SCOPE = "reporting:read";
export const STYTCH_TEST_ISSUER = "https://detailed-airship-7820.customers.stytch.dev";
const PRODUCTION_RESOURCE = "https://iworkhere-reporting.vercel.app/mcp";
export interface ResourceConfig { resource: string; issuer: string; metadataUrl: string }
export interface AuthConfig extends ResourceConfig { jwks: string; introspection: string; clientId: string; clientSecret: string; subject: readonly string[]; profile?: "standard" | "stytch-test" | "stytch-live" }
function configuredUrl(value: string | undefined, production: boolean): URL {
    if (!value || value.length > 2048) throw new ServiceUnavailable("configuration");
    const url = new URL(value);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && !production))) throw new ServiceUnavailable("configuration");
    return url;
}
export function resourceConfig(env: NodeJS.ProcessEnv = process.env): ResourceConfig {
    try {
        const resource = env.REPORTING_RESOURCE_URL!, issuer = env.REPORTING_OAUTH_ISSUER!;
        const url = configuredUrl(resource, env.NODE_ENV === "production"); configuredUrl(issuer, env.NODE_ENV === "production");
        if (url.pathname !== "/mcp") throw new ServiceUnavailable("configuration");
        if (issuer === STYTCH_TEST_ISSUER && (env.VERCEL_ENV === "production" || resource === PRODUCTION_RESOURCE)) throw new ServiceUnavailable("configuration");
        return { resource, issuer, metadataUrl: url.origin + "/.well-known/oauth-protected-resource" };
    } catch { throw new ServiceUnavailable("configuration"); }
}
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
    try {
        const resource = resourceConfig(env), jwks = env.REPORTING_OAUTH_JWKS_URL!, introspection = env.REPORTING_OAUTH_INTROSPECTION_URL!;
        configuredUrl(jwks, env.NODE_ENV === "production"); configuredUrl(introspection, env.NODE_ENV === "production");
        const profile = env.REPORTING_OAUTH_PROFILE ?? "standard";
        if (profile !== "standard" && profile !== "stytch-test" && profile !== "stytch-live") throw new ServiceUnavailable("configuration");
        if (profile === "stytch-test" && (resource.issuer !== STYTCH_TEST_ISSUER || jwks !== STYTCH_TEST_ISSUER + "/.well-known/jwks.json" || introspection !== STYTCH_TEST_ISSUER + "/v1/oauth2/introspect")) throw new ServiceUnavailable("configuration");
        if (profile === "stytch-live" && (env.VERCEL_ENV !== "production" || resource.resource !== PRODUCTION_RESOURCE || resource.issuer !== STYTCH_LIVE_ISSUER || jwks !== STYTCH_LIVE_ISSUER + "/.well-known/jwks.json" || introspection !== STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect")) throw new ServiceUnavailable("configuration");
        const slot = env.REPORTING_INTROSPECTION_CREDENTIAL_SLOT ?? "current";
        if (slot !== "current" && slot !== "next") throw new ServiceUnavailable("configuration");
        if (slot === "next" && (profile !== "stytch-test" || env.VERCEL_ENV !== "preview" || env.REPORTING_PREVIEW_FIXTURE !== "true" || env.REPORTING_DATABASE_URL)) throw new ServiceUnavailable("configuration");
        const clientId = env.REPORTING_INTROSPECTION_CLIENT_ID;
        const clientSecret = slot === "next" ? env.REPORTING_INTROSPECTION_CLIENT_SECRET_NEXT : env.REPORTING_INTROSPECTION_CLIENT_SECRET;
        const subject: unknown = JSON.parse(env.REPORTING_ALLOWED_SUBJECTS ?? "null");
        if (!clientId || !clientSecret || clientId.length > 512 || clientSecret.length > 4096 || !Array.isArray(subject) || !subject.length || subject.length > 20
            || subject.some(item => typeof item !== "string" || item.length === 0 || item.length > 256 || /[\x00-\x20]/.test(item))) throw new ServiceUnavailable("configuration");
        return { ...resource, jwks, introspection, clientId, clientSecret, subject, profile };
    } catch { throw new ServiceUnavailable("configuration"); }
}
export function protectedResourceMetadata(config: ResourceConfig) {
    return { resource: config.resource, authorization_servers: [config.issuer], scopes_supported: [REQUIRED_SCOPE], bearer_methods_supported: ["header"] };
}
/** JWT signature/claims AND uncached RFC7662 active state on every request.
 * Provider policy must deactivate tokens when the operator/session is revoked. */
export function authenticationGate(config: AuthConfig, fetcher: typeof fetch = fetch) {
    return async (request: Request): Promise<AuthInfo | Response> => {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
        const safeFetch: typeof fetch = async (input, init) => {
            const upstream = await fetcher(input, { ...init, cache: "no-store", redirect: "error", signal });
            const bytes = await boundedBytes(upstream, 32 * 1024);
            return new Response(bytes, { status: upstream.status, headers: upstream.headers });
        };
        const keys = createRemoteJWKSet(new URL(config.jwks), { cacheMaxAge: 0, cooldownDuration: 0, timeoutDuration: 5000, [customFetch]: safeFetch });
        const gate = requireBearerAuth({ requiredScopes: [REQUIRED_SCOPE], expectedResource: new URL(config.resource), resourceMetadataUrl: config.metadataUrl, verifier: {
            async verifyAccessToken(token): Promise<AuthInfo> {
                try {
                    if (token.length > 8192) throw new OAuthError("invalid_token", "Invalid access token");
                    const live = config.profile === "stytch-live", stytch = live || config.profile === "stytch-test";
                    if (live && (config.resource !== PRODUCTION_RESOURCE || config.issuer !== STYTCH_LIVE_ISSUER || config.jwks !== STYTCH_LIVE_ISSUER + "/.well-known/jwks.json" || config.introspection !== STYTCH_LIVE_ISSUER + "/v1/oauth2/introspect")) throw new OAuthError("invalid_token", "Invalid access token");
                    const typ = stytch ? decodeProtectedHeader(token).typ : "at+jwt";
                    if ((live && typ !== "JWT") || (!live && typ !== "at+jwt" && !(config.profile === "stytch-test" && typ === "JWT"))) throw new OAuthError("invalid_token", "Invalid access token");
                    const { payload } = await jwtVerify(token, keys, { algorithms: live ? ["RS256"] : ["RS256", "ES256"], issuer: config.issuer, audience: config.resource, requiredClaims: ["iss", "aud", "exp", "sub", "iat"], typ });
                    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) || typeof payload.scope !== "string") throw new OAuthError("invalid_token", "Invalid access token");
                    if (live && (typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat) || payload.iat < 0 || payload.iat >= payload.exp)) throw new OAuthError("invalid_token", "Invalid access token");
                    const client = new URLSearchParams({ v: config.clientId }).toString().slice(2);
                    const secret = new URLSearchParams({ v: config.clientSecret }).toString().slice(2);
                    const basic = Buffer.from(client + ":" + secret).toString("base64");
                    const response = await safeFetch(config.introspection, { method: "POST", headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token, token_type_hint: "access_token" }) });
                    if (!response.ok) throw new OAuthError("invalid_token", "Authorization unavailable");
                    const state: unknown = await response.json();
                    if (typeof state !== "object" || state === null || Array.isArray(state)) throw new OAuthError("invalid_token", "Invalid access token");
                    const current = state as Record<string, unknown>;
                    // Stytch uses JWT rather than the RFC9068 header. Require the
                    // provider to identify it as an active access token, never an ID token.
                    if (stytch && current.token_type !== "access_token") throw new OAuthError("invalid_token", "Invalid access token");
                    // Bind introspection to the signed token; scope removal takes effect immediately.
                    const audience = Array.isArray(current.aud) ? current.aud : [current.aud];
                    // Independently verified Stytch Test and Live introspection name the confidential client,
                    // not access_token_custom_audience. JWT resource validation above
                    // remains exact; do not accept another introspection client.
                    const audienceMatches = stytch
                        ? audience.length === 1 && audience[0] === config.clientId && current.client_id === config.clientId
                        : audience.includes(config.resource);
                    // Stytch's network response can shift iat/exp together by one
                    // second. Require the same lifetime and enforce the earlier exp.
                    const expiryMatches = typeof current.exp === "number" && (stytch
                        ? Math.abs(current.exp - payload.exp) <= 1 && typeof current.iat === "number" && Number.isSafeInteger(current.iat)
                            && typeof payload.iat === "number" && current.iat - payload.iat === current.exp - payload.exp
                            && (!live || current.exp >= payload.exp)
                        : current.exp <= payload.exp);
                    if (current.active !== true || current.sub !== payload.sub || current.iss !== config.issuer || !audienceMatches
                        || typeof current.exp !== "number" || !Number.isSafeInteger(current.exp) || current.exp <= Date.now() / 1000
                        || !expiryMatches || typeof current.scope !== "string" || typeof current.client_id !== "string" || !current.client_id
                        || (current.nbf !== undefined && (typeof current.nbf !== "number" || current.nbf > Date.now() / 1000))) throw new OAuthError("invalid_token", "Invalid access token");
                    const signedScopes = payload.scope.split(" ");
                    const scopes = current.scope.split(" ").filter(scope => signedScopes.includes(scope));
                    return { token, clientId: current.client_id, scopes, expiresAt: Math.min(current.exp, payload.exp), resource: new URL(config.resource), extra: { subject: payload.sub } };
                } catch {
                    throw new OAuthError("invalid_token", "Invalid or unavailable authorization");
                }
            },
        } });
        try {
            const result = await gate(request);
            if (result instanceof Response) return result;
            if (typeof result.extra?.subject !== "string" || !config.subject.includes(result.extra.subject)) return safeResponse(403, "access_denied");
            return { token: result.token, clientId: result.clientId, scopes: result.scopes, expiresAt: result.expiresAt, resource: result.resource };
        }
        catch { return safeResponse(403, "access_denied"); }
    };
}
