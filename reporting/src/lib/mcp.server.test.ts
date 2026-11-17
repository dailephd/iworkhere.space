import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reportingFixture, reportingNow } from "../../../dashboard/src/test/reportingFixture";
import { loadReporting } from "../../../dashboard/src/lib/reportingDatabase.server";
import { reportingModel } from "../../../dashboard/src/lib/reportingModel";
import { fixtureIssuer } from "../test/issuer";
import { handleMcp, handleMetadata, reportingService } from "./mcp.server";
import { PROTOCOL_VERSION_META_KEY, CLIENT_CAPABILITIES_META_KEY, CLIENT_INFO_META_KEY } from "@modelcontextprotocol/server";
import { FIXTURE_NOTICE } from "./previewFixture.server";
let issuer: Awaited<ReturnType<typeof fixtureIssuer>>;
beforeEach(async () => { issuer = await fixtureIssuer(); });
afterEach(async () => { await issuer.close(); vi.unstubAllEnvs(); });
const input = { schemaVersion: 1, range: "24h" };
it("labels authenticated Preview fixture discovery and results without changing the strict DTO", async () => {
    const service = reportingService({ config: issuer.config, observe: async () => report(), fixture: true });
    async function call(method: string, params: unknown) {
        const token = await issuer.sign();
        const response = await service(new Request(issuer.config.resource, { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json, text/event-stream", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
        expect(response.headers.get("X-Reporting-Credential-Fingerprint")).toBe(createHash("sha256").update(issuer.config.clientSecret).digest("hex"));
        const text = await response.text();
        expect(text).not.toContain(issuer.config.clientSecret);
        return response.headers.get("content-type")?.includes("text/event-stream") ? JSON.parse(text.split("\n").filter(line => line.startsWith("data: ")).at(-1)!.slice(6)) : JSON.parse(text);
    }
    const listed = await call("tools/list", {});
    expect(listed.result.tools[0].description).toContain(FIXTURE_NOTICE);
    const called = await call("tools/call", { name: "observability_report", arguments: input });
    expect(called.result.content[0].text).toBe(FIXTURE_NOTICE);
    expect(called.result.structuredContent).toEqual(report());
    const unauthorized = await service(new Request(issuer.config.resource, { method: "POST" }));
    expect(unauthorized.status).toBe(401); expect(unauthorized.headers.has("X-Reporting-Credential-Fingerprint")).toBe(false);
});
function report() { return reportingModel(input, reportingFixture(), reportingNow); }
async function rpc(method: string, params: unknown = {}, observe: (input: unknown) => Promise<unknown> = async () => report()) {
    const token = await issuer.sign();
    const response = await reportingService({ config: issuer.config, observe })(new Request(issuer.config.resource, { method: "POST", headers: { Authorization: "Bearer " + token, ...(method === "server/discover" ? { "MCP-Protocol-Version": "2026-07-28", "MCP-Method": method } : {}), Accept: "application/json, text/event-stream", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
    const text = await response.text();
    const payload = response.headers.get("content-type")?.includes("text/event-stream") ? text.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6))).at(-1) : JSON.parse(text);
    return { response, text, payload };
}
it("initializes and discovers one read-only tool via SDK compatibility transport", async () => {
    const initialized = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "fixture-client", version: "1" } });
    expect(initialized.response.status).toBe(200); expect(initialized.payload.result.serverInfo.name).toBe("iworkhere-observability-reporting");
    expect(initialized.response.headers.has("mcp-session-id")).toBe(false);
    const listed = await rpc("tools/list"); expect(listed.payload.result.tools.map((item: { name: string }) => item.name)).toEqual(["observability_report"]);
    expect(listed.payload.result.tools[0].inputSchema.additionalProperties).toBe(false);
});
it("supports modern stateless discovery through the SDK", async () => {
    const result = await rpc("server/discover", { _meta: { [PROTOCOL_VERSION_META_KEY]: "2026-07-28", [CLIENT_CAPABILITIES_META_KEY]: {}, [CLIENT_INFO_META_KEY]: { name: "fixture-client", version: "1" } } });
    expect(result.response.status, JSON.stringify(result.payload)).toBe(200); expect(result.payload.error).toBeUndefined();
});
it("invokes B1 and preserves totals/health/privacy in a bounded complete response", async () => {
    const result = await rpc("tools/call", { name: "observability_report", arguments: input });
    expect(result.response.status).toBe(200); expect(result.payload.result.structuredContent).toEqual(report());
    expect(result.payload.result.structuredContent.health.state).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.text).not.toMatch(/stack|contact_email|Bearer|secret|postgresql/); expect(Buffer.byteLength(result.text)).toBeLessThan(65536);
});
it.each([{ ...input, schemaVersion: 2 }, { ...input, range: "DROP TABLE" }, { ...input, sql: "SELECT private" }])("rejects bad tool input before query: %j", async args => {
    const observe = vi.fn(); const result = await rpc("tools/call", { name: "observability_report", arguments: args }, observe);
    expect(result.payload.error ?? result.payload.result.isError).toBeTruthy(); expect(observe).not.toHaveBeenCalled();
});
it("rejects unknown operations/methods without a database call", async () => {
    const observe = vi.fn();
    const tool = await rpc("tools/call", { name: "arbitrary_sql", arguments: {} }, observe);
    expect(tool.payload.error ?? tool.payload.result.isError).toBeTruthy();
    const method = await rpc("unknown/method", {}, observe); expect(method.payload.error).toBeDefined(); expect(observe).not.toHaveBeenCalled();
});
it.each(["support text", { message: "private diagnostic", stack: "secret", context: ["private"] }, { harmless: { nested: ["contact@example.invalid"] } }])("rejects foreign result %j", async foreign => {
    const result = await rpc("tools/call", { name: "observability_report", arguments: input }, async () => ({ ...report(), harmless: foreign }));
    expect(result.payload.result.isError).toBe(true); expect(result.text).not.toMatch(/contact@|private diagnostic|support text|stack/);
});
it("withholds raw errors, oversized results and invalid numbers", async () => {
    for (const observe of [async () => { throw new Error("postgresql://private-secret"); }, async () => ({ ...report(), navigationCount: Infinity }), async () => ({ ...report(), extra: "private".repeat(20000) })]) {
        const result = await rpc("tools/call", { name: "observability_report", arguments: input }, observe);
        expect(result.payload.result.isError).toBe(true); expect(result.text).not.toMatch(/private|postgresql|Infinity/);
    }
});
it("fails closed for missing configuration, invalid origin, malformed requests and HTTP methods", async () => {
    vi.stubEnv("REPORTING_RESOURCE_URL", undefined); expect((await handleMcp(new Request("https://service.example/mcp"))).status).toBe(503); expect(handleMetadata().status).toBe(503);
    const service = reportingService({ config: issuer.config, observe: async () => report() });
    expect((await service(new Request(issuer.config.resource, { headers: { Origin: "https://evil.example" } }))).status).toBe(403);
    const token = await issuer.sign();
    expect((await service(new Request(issuer.config.resource, { method: "PUT", headers: { Authorization: "Bearer " + token } }))).status).toBe(405);
    expect((await service(new Request(issuer.config.resource, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "not JSON" }))).status).toBe(400);
});
it("bootstraps OAuth with public metadata and an SDK challenge before private enrollment exists", async () => {
    vi.stubEnv("REPORTING_RESOURCE_URL", "https://service.example/mcp");
    vi.stubEnv("REPORTING_OAUTH_ISSUER", "https://issuer.example");
    for (const key of ["REPORTING_OAUTH_JWKS_URL", "REPORTING_OAUTH_INTROSPECTION_URL", "REPORTING_INTROSPECTION_CLIENT_ID", "REPORTING_INTROSPECTION_CLIENT_SECRET", "REPORTING_ALLOWED_SUBJECTS"]) vi.stubEnv(key, undefined);
    const network = vi.spyOn(globalThis, "fetch");
    try {
        const metadata = handleMetadata();
        expect(metadata.status).toBe(200);
        expect(await metadata.json()).toEqual({ resource: "https://service.example/mcp", authorization_servers: ["https://issuer.example"], scopes_supported: ["reporting:read"], bearer_methods_supported: ["header"] });
        for (const method of ["GET", "POST"]) {
            const response = await handleMcp(new Request("https://service.example/mcp", { method }));
            expect(response.status).toBe(401);
            expect(response.headers.get("www-authenticate")).toContain('resource_metadata="https://service.example/.well-known/oauth-protected-resource"');
            expect(response.headers.get("cache-control")).toBe("no-store");
            expect(await response.text()).not.toMatch(/secret|subject|postgres|navigationCount/);
        }
        for (const authorization of ["", "Bearer untrusted", "Basic untrusted"]) {
            expect((await handleMcp(new Request("https://service.example/mcp", { headers: { authorization } }))).status).toBe(503);
        }
        expect((await handleMcp(new Request("https://service.example/mcp", { headers: { origin: "https://evil.example" } }))).status).toBe(403);
        expect((await handleMcp(new Request("https://evil.example/mcp"))).status).toBe(403);
        expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
});
it("never falls through expired Live validation mode to tools or database access", async () => {
    const live = "https://eminent-plume-9461.customers.stytch.com";
    for (const [key, value] of Object.entries({ REPORTING_RESOURCE_URL: "https://iworkhere-reporting.vercel.app/mcp", REPORTING_OAUTH_ISSUER: live, REPORTING_OAUTH_JWKS_URL: live + "/.well-known/jwks.json", REPORTING_OAUTH_INTROSPECTION_URL: live + "/v1/oauth2/introspect", REPORTING_OAUTH_PROFILE: "standard", REPORTING_INTROSPECTION_CLIENT_ID: "fixture-client", REPORTING_INTROSPECTION_CLIENT_SECRET: "fixture-secret", REPORTING_ALLOWED_SUBJECTS: '["enrolled-operator"]', REPORTING_LIVE_VALIDATION_UNTIL: "1" })) vi.stubEnv(key, value);
    const network = vi.spyOn(globalThis, "fetch");
    try {
        const response = await handleMcp(new Request("https://iworkhere-reporting.vercel.app/mcp", { method: "POST", headers: { authorization: "Bearer untrusted" } }));
        expect(response.status).toBe(503); expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
});
it("runs successful and revoked requests over real isolated local HTTP", async () => {
    const observe = vi.fn(async (input: unknown) => {
        const fixture = reportingFixture();
        return loadReporting(input, { transaction: async () => [fixture.activity, fixture.vital, fixture.evidence] }, reportingNow);
    });
    const server = createServer(async (incoming, outgoing) => {
        const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const headers = new Headers(); for (const [name, value] of Object.entries(incoming.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
        const request = new Request(issuer.config.resource, { method: incoming.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
        const result = await service(request); outgoing.writeHead(result.status, Object.fromEntries(result.headers)); outgoing.end(Buffer.from(await result.arrayBuffer()));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("fixture runtime failed");
    issuer.config.resource = `http://127.0.0.1:${address.port}/mcp`; issuer.config.metadataUrl = `http://127.0.0.1:${address.port}/.well-known/oauth-protected-resource`;
    const service = reportingService({ config: issuer.config, observe });
    try {
        const token = await issuer.sign(), body = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "observability_report", arguments: input } });
        const headers = { Authorization: "Bearer " + token, Accept: "application/json, text/event-stream", "Content-Type": "application/json" };
        expect((await fetch(issuer.config.resource, { method: "POST", body })).status).toBe(401);
        const unenrolledToken = await issuer.sign({ sub: "not-enrolled" });
        const unenrolled = await fetch(issuer.config.resource, { method: "POST", headers: { ...headers, Authorization: "Bearer " + unenrolledToken }, body }); expect(unenrolled.status).toBe(403);
        const good = await fetch(issuer.config.resource, { method: "POST", headers, body }); expect(good.status).toBe(200); expect(await good.text()).toContain("navigationCount");
        issuer.state.active = false; const revoked = await fetch(issuer.config.resource, { method: "POST", headers, body }); expect(revoked.status).toBe(401); expect(await revoked.text()).not.toContain("navigationCount"); expect(observe).toHaveBeenCalledTimes(1);
    } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});


it("does not log or reflect secret-like invalid input or server errors", async () => {
    const error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn"), log = vi.spyOn(console, "log");
    try {
        const result = await rpc("tools/call", { name: "observability_report", arguments: { ...input, "support text secret email": { stack: "secret" } } });
        expect(result.text).not.toMatch(/support text|secret email|stack/);
        await rpc("tools/call", { name: "observability_report", arguments: input }, async () => { throw new Error("private secret database URL"); });
        expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    } finally { error.mockRestore(); warn.mockRestore(); log.mockRestore(); }
});
it("rejects oversized HTTP bodies before query execution", async () => {
    const observe = vi.fn(), token = await issuer.sign();
    const result = await reportingService({ config: issuer.config, observe })(new Request(issuer.config.resource, { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json, text/event-stream", "Content-Type": "application/json" }, body: "x".repeat(16385) }));
    expect(result.status).toBe(413); expect(observe).not.toHaveBeenCalled();
});

it("invokes the same B1 tool under modern per-request negotiation", async () => {
    const token = await issuer.sign();
    const request = new Request(issuer.config.resource, { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "observability_report" }, body: JSON.stringify({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "observability_report", arguments: input, _meta: { [PROTOCOL_VERSION_META_KEY]: "2026-07-28", [CLIENT_CAPABILITIES_META_KEY]: {}, [CLIENT_INFO_META_KEY]: { name: "fixture-client", version: "1" } } } }) });
    const result = await reportingService({ config: issuer.config, observe: async () => report() })(request);
    expect(result.status).toBe(200);
    const payload = await result.json(); expect(payload.result.structuredContent).toEqual(report());
});
