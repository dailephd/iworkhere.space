import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Minimal Neon SQL-over-HTTP endpoint for a disposable local PostgreSQL container.
 * The connection-string user selects the database role (SET ROLE), so the real
 * least-privilege grants apply to every statement the application issues. Test use only.
 */
export interface NeonShim { endpoint: string; port: number; close(): Promise<void> }

const ROLE = new Set(["support_writer", "support_worker", "support_dashboard"]);
interface QueryBody { query: string; params: unknown[] }

function literal(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return `'${String(value).replaceAll("'", "''")}'`;
}
export function bind(query: string, params: unknown[]): string {
    return query.replace(/\$(\d+)/g, (_match, index: string) => literal(params[Number(index) - 1]));
}
function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let text = "";
        request.on("data", chunk => { text += chunk; });
        request.on("end", () => resolve(text));
        request.on("error", reject);
    });
}
function psql(container: string, script: string): Promise<{ status: number | null; out: string; err: string }> {
    return new Promise(resolve => {
        const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { windowsHide: true, shell: false });
        let out = ""; let err = "";
        child.stdout.on("data", chunk => { out += chunk; });
        child.stderr.on("data", chunk => { err += chunk; });
        child.on("close", status => resolve({ status, out, err }));
        child.stdin.end(script);
    });
}
function typeOf(value: unknown): number {
    if (typeof value === "boolean") return 16;
    if (typeof value === "number") return Number.isInteger(value) ? 23 : 701;
    return 25;
}
function text(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value ? "t" : "f";
    return String(value);
}
/** Neon array mode: rows as arrays of text with field descriptors. */
function neonResult(rows: Record<string, unknown>[]) {
    const names = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
        command: "SELECT", rowCount: rows.length, rowAsArray: true,
        fields: names.map(name => ({ name, dataTypeID: typeOf(rows.find(row => row[name] !== null)?.[name]) })),
        rows: rows.map(row => names.map(name => text(row[name]))),
    };
}
const wrap = (query: QueryBody, index: number) => `SELECT jsonb_build_object('i', ${index}, 'rows', coalesce(jsonb_agg(t), '[]'::jsonb)) FROM (${bind(query.query, query.params ?? [])}) t;`;

export async function startNeonShim(options: { container: string; port?: number }): Promise<NeonShim> {
    const server: Server = createServer(async (request, response) => {
        const send = (status: number, body: unknown) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
        try {
            if (request.method !== "POST" || request.url !== "/sql") return send(404, { message: "not found" });
            const connection = request.headers["neon-connection-string"];
            const role = new URL(String(connection)).username;
            if (!ROLE.has(role)) return send(400, { message: "unknown role" });
            const body = JSON.parse(await readBody(request)) as QueryBody | { queries: QueryBody[] };
            const batch = "queries" in body;
            const queries = batch ? body.queries : [body];
            const isolation = String(request.headers["neon-batch-isolation-level"] ?? "ReadCommitted").replace("RepeatableRead", "REPEATABLE READ").replace("ReadCommitted", "READ COMMITTED").replace("Serializable", "SERIALIZABLE");
            const readOnly = request.headers["neon-batch-read-only"] === "true" ? "READ ONLY" : "READ WRITE";
            const script = batch
                ? `BEGIN ISOLATION LEVEL ${isolation} ${readOnly};\nSET LOCAL ROLE ${role};\n${queries.map(wrap).join("\n")}\nCOMMIT;\n`
                : `SET ROLE ${role};\n${queries.map(wrap).join("\n")}\n`;
            const result = await psql(options.container, script);
            if (result.status !== 0) return send(400, { message: (/ERROR:\s+(.*)/.exec(result.err)?.[1] ?? "query failed").trim(), severity: "ERROR" });
            const rows = result.out.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line) as { i: number; rows: Record<string, unknown>[] });
            if (batch) return send(200, { results: rows.map(item => neonResult(item.rows)) });
            return send(200, neonResult(rows[0]?.rows ?? []));
        } catch {
            return send(400, { message: "shim failure" });
        }
    });
    await new Promise<void>(resolve => server.listen(options.port ?? 0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Neon shim failed to bind");
    return { endpoint: `http://127.0.0.1:${address.port}/sql`, port: address.port, close: () => new Promise<void>(resolve => { server.closeAllConnections?.(); server.close(() => resolve()); }) };
}
