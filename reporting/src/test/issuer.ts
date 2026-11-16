import { createServer } from "node:http";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import type { AuthConfig } from "../lib/auth.server";

/** Test-only issuer. No production source imports this module. */
export async function fixtureIssuer(resource = "https://reporting.example/mcp") {
    let key = await generateKeyPair("ES256"); let kid = "fixture-key-1";
    let published = [{ ...await exportJWK(key.publicKey), kid, alg: "ES256", use: "sig" }];
    const state = { active: true, scope: "reporting:read", calls: 0, authorization: "", unavailable: false, override: {} as Record<string, unknown> };
    const server = createServer(async (request, response) => {
        if (state.unavailable) { response.writeHead(503); response.end(); return; }
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/jwks") { response.end(JSON.stringify({ keys: published })); return; }
        if (request.url !== "/introspect") { response.writeHead(404); response.end(); return; }
        const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = new URLSearchParams(Buffer.concat(chunks).toString());
        const claims = decodeJwt(body.get("token")!);
        state.calls++; state.authorization = request.headers.authorization ?? "";
        response.end(JSON.stringify({ active: state.active, sub: claims.sub, aud: claims.aud, iss: claims.iss, exp: claims.exp, scope: state.scope, client_id: "fixture-chatgpt-client", ...state.override }));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture listen failed");
    const origin = `http://127.0.0.1:${address.port}`;
    const config: AuthConfig = { resource, issuer: origin, metadataUrl: new URL(resource).origin + "/.well-known/oauth-protected-resource", jwks: origin + "/jwks", introspection: origin + "/introspect", clientId: "fixture-reader", clientSecret: "fixture-introspection-secret", subject: ["enrolled-operator"] };
    async function sign(claim: JWTPayload = {}, typ = "at+jwt") {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT({ scope: "reporting:read", ...claim }).setProtectedHeader({ alg: "ES256", kid, typ }).setIssuer(String(claim.iss ?? config.issuer)).setAudience(claim.aud ?? config.resource).setSubject(String(claim.sub ?? "enrolled-operator")).setIssuedAt().setExpirationTime(claim.exp ?? now + 300).sign(key.privateKey);
    }
    return { config, state, sign,
        async rotate() { key = await generateKeyPair("ES256"); kid = "fixture-key-2"; published = [{ ...await exportJWK(key.publicKey), kid, alg: "ES256", use: "sig" }]; },
        close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }),
    };
}
