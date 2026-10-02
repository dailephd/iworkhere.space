import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
const valid = { level: "info", message: "Application event", timestamp: "2026-10-01T00:00:00Z", pathname: "/tool/image-resizer", meta: { toolId: "image-resizer" } };
const request = (body: unknown) => new Request("http://localhost/api/log", { method: "POST", body: JSON.stringify(body) });
afterEach(() => vi.restoreAllMocks());
it.each(["debug", "info", "warn", "error"])("accepts safe %s structured logs", async level => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await POST(request({ ...valid, level }))).status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ source: "application-log", ...valid, level });
});
it.each([{}, { ...valid, level: "critical" }, { ...valid, message: "private.png" }, { ...valid, url: "https://example.com/?private" }, { ...valid, meta: { filename: "private.png" } }, { ...valid, pathname: "/?expr=private" }, { ...valid, timestamp: "invalid" }, { ...valid, meta: { input: "x".repeat(9000) } }])("rejects invalid or unsafe log bodies", async body => {
    expect((await POST(request(body))).status).toBe(400);
});
it("rejects invalid JSON", async () => expect((await POST(new Request("http://localhost/api/log", { method: "POST", body: "{" }))).status).toBe(400));
