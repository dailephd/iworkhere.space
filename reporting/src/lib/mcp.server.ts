import "server-only";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { RANGE } from "../../../dashboard/src/lib/range";
import { reportingRequest } from "../../../dashboard/src/lib/reportingModel";
import { authenticationGate, authConfig, resourceConfig, protectedResourceMetadata, type AuthConfig } from "./auth.server";
import { observe } from "./observability.server";
import { boundedBytes, boundedProtocolText, MAX_MCP_BYTES, reportResult, safeResponse, unavailableResult } from "./response";

export interface ReportingServiceOption {
    config: AuthConfig;
    fetcher?: typeof fetch;
    observe: (request: unknown) => Promise<unknown>;
}
/** Testable composition seam; production route always uses real auth and database adapters. */
export function reportingService(option: ReportingServiceOption) {
    const gate = authenticationGate(option.config, option.fetcher);
    return async (request: Request): Promise<Response> => {
        const resource = new URL(option.config.resource), received = new URL(request.url);
        const origin = request.headers.get("origin");
        if (received.origin !== resource.origin || received.pathname !== resource.pathname || (origin !== null && origin !== resource.origin)) return safeResponse(403, "forbidden_origin");
        const auth = await gate(request);
        if (auth instanceof Response) { auth.headers.set("Cache-Control", "no-store"); return auth; }
        const handler = createMcpHandler(() => {
            const server = new McpServer({ name: "iworkhere-observability-reporting", version: "1.0.0" });
            server.registerTool("observability_report", {
                title: "Observability aggregate report",
                description: "Read-only aggregate observability events for rolling 24h, 7d, 30d, 90d, or daily 180d, calendar 1y, all history plus incomplete current UTC day. Counts are events, never unique users. No raw diagnostics or support records. UTC server receipt time. Health needs independent evidence; missing monitoring means insufficient evidence, not proven health or zero traffic. Long-range vitals are typical daily p75, not full-range p75.",
                inputSchema: z.strictObject({ schemaVersion: z.literal(1), range: z.enum(RANGE) }),
                annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
                _meta: { securitySchemes: [{ type: "oauth2", scopes: ["reporting:read"] }] },
            }, async (input) => {
                try { return reportResult(await option.observe(reportingRequest(input))); }
                catch { return unavailableResult(); }
            });
            return server;
        }, { legacy: "stateless", responseMode: "auto", maxRequestBodySize: 16 * 1024, maxSubscriptions: 0 });
        try {
            const response = await handler.fetch(request, { authInfo: auth });
            if (!response.body) { response.headers.set("Cache-Control", "no-store"); return response; }
            // SDK legacy replies may use SSE. Bound the actual complete wire body too.
            const bytes = await boundedBytes(response, MAX_MCP_BYTES);
            const headers = new Headers(response.headers); headers.set("Cache-Control", "no-store"); headers.delete("Content-Length");
            const text = boundedProtocolText(new TextDecoder().decode(bytes), headers.get("content-type") ?? "");
            return new Response(text, { status: response.status, headers });
        } catch { return safeResponse(503, "reporting_unavailable"); }
        finally { await handler.close(); }
    };
}
export async function handleMcp(request: Request): Promise<Response> {
    try { return await reportingService({ config: authConfig(), observe })(request); }
    catch { return safeResponse(503, "configuration_unavailable"); }
}
export function handleMetadata(): Response {
    try {
        const config = resourceConfig();
        return Response.json(protectedResourceMetadata(config), { headers: { "Cache-Control": "no-store" } });
    } catch { return safeResponse(503, "configuration_unavailable"); }
}
