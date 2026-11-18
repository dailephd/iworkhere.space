import { expect, it, vi } from "vitest";
import { PUBLIC_PROJECT } from "./reportingMonitoringSource";
import { vercelMonitoringRead, vercelMonitoringProvider, type VercelAuthorizationResult } from "./reportingVercelSource";

const owner = "team_sQEdGnWaessGuITNTUuPtmfx";
const token = "synthetic-fixture-token";
const window = { start: "2026-11-18T11:00:00.000Z", end: "2026-11-18T11:05:00.000Z" };
const request = { kind: "counts" as const, path: `/metrics/v1?teamId=${owner}`, body: { scope: { projectIds: [PUBLIC_PROJECT] } } };

it("uses the supplied bearer credential for the exact project and source APIs", async () => {
    const emit = vi.fn();
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ id: PUBLIC_PROJECT, accountId: owner }))
        .mockResolvedValueOnce(Response.json({ rows: [], hasMoreRows: false })).mockResolvedValueOnce(Response.json({ summary: [], series: [] }));
    const client = vercelMonitoringRead(token, emit, send);
    await client.verifyProject();
    const provider = vercelMonitoringProvider(client.read);
    expect(await provider.logs(window)).toBe("");
    await provider.counts(window);
    expect(emit.mock.calls).toEqual([[{ source: "observability-health-source", kind: "project", status: 200, outcome: "verified" }]]);
    expect(send.mock.calls[0][0]).toBe(`https://api.vercel.com/v9/projects/${PUBLIC_PROJECT}?teamId=${owner}`);
    expect(send.mock.calls[1][0]).toContain("https://vercel.com/api/logs/request-logs?projectId=");
    expect(send.mock.calls[2][0]).toBe(`https://api.vercel.com/metrics/v1?teamId=${owner}`);
    for (const [, init] of send.mock.calls) {
        expect(init?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
        expect(init?.redirect).toBe("error");
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(send.mock.calls[2][1]?.method).toBe("POST");
    expect(JSON.stringify(emit.mock.calls)).not.toContain(token);
});

it.each([
    [403, { error: { invalidToken: true, message: "private credential" } }, "invalid_token"],
    [403, { error: { missingToken: true, message: "private credential" } }, "missing_token"],
    [403, { error: { code: "forbidden", message: "private credential" } }, "forbidden"],
    [401, { error: { message: "private credential" } }, "unauthorized"],
    [402, { error: { message: "private credential" } }, "plan_limit"],
    [500, { error: { message: "private credential" } }, "unavailable"],
] as const)("distinguishes HTTP %s without serializing provider errors", async (status, body, outcome) => {
    const emitted: VercelAuthorizationResult[] = [];
    const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
    await expect(vercelMonitoringRead(token, result => emitted.push(result), send).read(request)).rejects.toThrow("source_unavailable");
    expect(emitted).toEqual([{ source: "observability-health-source", kind: "counts", status, outcome }]);
    expect(JSON.stringify(emitted)).not.toMatch(/private|credential|message|Bearer/);
});

it("can distinguish valid project access from forbidden monitoring APIs", async () => {
    const emit = vi.fn();
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ id: PUBLIC_PROJECT, accountId: owner }))
        .mockResolvedValueOnce(Response.json({ error: { message: "private provider detail" } }, { status: 403 }));
    const client = vercelMonitoringRead(token, emit, send);
    await client.verifyProject();
    await expect(client.read(request)).rejects.toThrow();
    expect(emit.mock.calls.map(([result]) => result.outcome)).toEqual(["verified", "forbidden"]);
});

it("rejects other projects, hosts, paths and redirection before credential transmission", async () => {
    const send = vi.fn<typeof fetch>();
    const client = vercelMonitoringRead(token, () => {}, send);
    for (const value of [
        { ...request, path: "https://other.example/metrics/v1" },
        { ...request, path: "/v9/projects/other" },
        { ...request, path: "/metrics/v1?teamId=other" },
        { kind: "logs" as const, path: "/api/logs/request-logs?projectId=other" },
    ]) await expect(client.read(value)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    const emit = vi.fn();
    const redirect = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://other.example" } }));
    await expect(vercelMonitoringRead(token, emit, redirect).read(request)).rejects.toThrow();
    expect(emit.mock.calls[0][0]).toMatchObject({ status: 302, outcome: "unavailable" });
});

it.each(["", "token\nheader", "x".repeat(4097)])("rejects invalid credential format without fallback", value => {
    const send = vi.fn<typeof fetch>();
    const emit = vi.fn();
    expect(() => vercelMonitoringRead(value, emit, send)).toThrow();
    expect(emit.mock.calls[0][0]).toMatchObject({ outcome: value ? "credential_format" : "missing_token", status: null });
    expect(send).not.toHaveBeenCalled();
});

it("bounds streamed bytes, cancels oversized sources, and retains the truncation reason", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); }, cancel });
    const emit = vi.fn();
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await expect(vercelMonitoringRead(token, emit, send).read(request)).rejects.toThrow("source_truncated");
    expect(cancel).toHaveBeenCalled();
    expect(emit.mock.calls[0][0]).toMatchObject({ outcome: "source_truncated" });
});

it("discards HTML errors and thrown network/timeout details", async () => {
    const emit = vi.fn();
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("private support content", { status: 403 }))
        .mockRejectedValueOnce(Error("private secret and diagnostic stack"));
    const client = vercelMonitoringRead(token, emit, send);
    await expect(client.read(request)).rejects.toThrow("source_unavailable");
    await expect(client.read(request)).rejects.toThrow("source_unavailable");
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(/private|secret|stack|support/);
    expect(emit.mock.calls.map(([result]) => result.outcome)).toEqual(["forbidden", "unavailable"]);
});

it.each([{ id: "other", accountId: owner }, { id: PUBLIC_PROJECT, accountId: "other" }])("never verifies the wrong project identity", async project => {
    const emit = vi.fn();
    await expect(vercelMonitoringRead(token, emit, vi.fn<typeof fetch>().mockResolvedValue(Response.json(project))).verifyProject()).rejects.toThrow();
    expect(emit).not.toHaveBeenCalled();
});
