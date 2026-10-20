import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Isolated substitutes for Cloudflare Turnstile, the GitHub REST API and Resend.
 * They validate the contract the application relies on and record every payload so tests can
 * assert what was sent. They prove deterministic behavior only, never real provider delivery.
 */
export interface RecordedIssue { number: number; title: string; body: string; html_url: string; labels: string[] }
export interface RecordedEmail { to: string[]; from: string; subject: string; text: string; idempotencyKey: string | null }
export interface ProviderState {
    issues: RecordedIssue[];
    emails: RecordedEmail[];
    turnstile: { calls: number; lastForm: Record<string, string> | null };
    githubCreateMode: "ok" | "timeout-after-create" | "fail";
    resendFailures: number;
}
export interface ProviderDouble { origin: string; state: ProviderState; reset(): void; close(): Promise<void> }

export const PROVIDER_SECRET = { turnstile: "e2e-turnstile-secret", github: "e2e-github-token", resend: "e2e-resend-key", validChallenge: "e2e-valid-token" } as const;

function fresh(): ProviderState {
    return { issues: [], emails: [], turnstile: { calls: 0, lastForm: null }, githubCreateMode: "ok", resendFailures: 0 };
}
function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let text = "";
        request.on("data", chunk => { text += chunk; });
        request.on("end", () => resolve(text));
        request.on("error", reject);
    });
}

export async function startProviderDouble(): Promise<ProviderDouble> {
    const state = fresh();
    const server: Server = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const send = (status: number, body: unknown) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
        const text = request.method === "POST" ? await readBody(request) : "";
        if (url.pathname === "/__state") return send(200, state);
        if (url.pathname === "/__control" && request.method === "POST") {
            const control = JSON.parse(text) as Partial<Pick<ProviderState, "githubCreateMode" | "resendFailures">>;
            if (control.githubCreateMode) state.githubCreateMode = control.githubCreateMode;
            if (typeof control.resendFailures === "number") state.resendFailures = control.resendFailures;
            return send(200, { ok: true });
        }
        if (url.pathname === "/turnstile" && request.method === "POST") {
            const form = Object.fromEntries(new URLSearchParams(text)) as Record<string, string>;
            state.turnstile.calls += 1; state.turnstile.lastForm = form;
            return send(200, { success: form.secret === PROVIDER_SECRET.turnstile && form.response === PROVIDER_SECRET.validChallenge });
        }
        if (url.pathname.startsWith("/github/")) {
            if (request.headers.authorization !== `Bearer ${PROVIDER_SECRET.github}`) return send(401, { message: "Bad credentials" });
            const path = url.pathname.slice("/github".length);
            if (path === "/repos/owner/private-support" && request.method === "GET") return send(200, { private: true });
            if (path === "/repos/owner/private-support/issues" && request.method === "GET") {
                const page = Number(url.searchParams.get("page") ?? "1");
                return send(200, state.issues.slice((page - 1) * 100, page * 100).map(issue => ({ ...issue, state: "open" })));
            }
            if (path === "/repos/owner/private-support/issues" && request.method === "POST") {
                if (state.githubCreateMode === "fail") return send(500, { message: "Server Error" });
                const input = JSON.parse(text) as { title: string; body: string; labels?: string[] };
                const number = state.issues.length + 1;
                state.issues.push({ number, title: input.title, body: input.body, html_url: `https://github.com/owner/private-support/issues/${number}`, labels: input.labels ?? [] });
                if (state.githubCreateMode === "timeout-after-create") { state.githubCreateMode = "ok"; request.socket.destroy(); return; }
                return send(201, state.issues[number - 1]);
            }
            return send(404, { message: "Not Found" });
        }
        if (url.pathname === "/resend/emails" && request.method === "POST") {
            if (request.headers.authorization !== `Bearer ${PROVIDER_SECRET.resend}`) return send(401, { message: "invalid api key" });
            if (state.resendFailures > 0) { state.resendFailures -= 1; return send(500, { message: "temporary failure" }); }
            const input = JSON.parse(text) as { to: string[]; from: string; subject: string; text: string };
            state.emails.push({ ...input, idempotencyKey: String(request.headers["idempotency-key"] ?? "") || null });
            return send(200, { id: `email-${state.emails.length}` });
        }
        return send(404, { message: "not found" });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Provider double failed to bind");
    return {
        origin: `http://127.0.0.1:${address.port}`,
        state,
        reset() { Object.assign(state, fresh()); },
        close: () => new Promise<void>(resolve => { server.closeAllConnections?.(); server.close(() => resolve()); }),
    };
}
