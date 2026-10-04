import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
interface WorkerEvent { request?: { url: string; method: string; mode: string }; respondWith?: ReturnType<typeof vi.fn>; waitUntil?: (promise: Promise<unknown>) => void }
function worker() {
    const listener = new Map<string, (event: WorkerEvent) => void>();
    const addAll = vi.fn(async () => {}), put = vi.fn(async () => {}), match = vi.fn(async (): Promise<Response | { cached: boolean }> => ({ cached: true }));
    const fetch = vi.fn(async () => ({ ok: true, clone: () => ({}) }));
    vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { URL, Response, fetch, caches: { match, open: async () => ({ addAll, put }), keys: async () => [] }, self: { addEventListener: (name: string, callback: (event: WorkerEvent) => void) => listener.set(name, callback), skipWaiting() {}, clients: { claim() {} } } });
    return { listener, addAll, match, put, fetch };
}
it("bypasses API/non-GET requests", () => {
    const runtime = worker();
    for (const [url, method] of [["/api/metric", "GET"], ["/api/metric", "POST"], ["/asset.js", "POST"]]) {
        const respondWith = vi.fn(); runtime.listener.get("fetch")!({ request: { url: `https://local.test${url}`, method, mode: "same-origin" }, respondWith }); expect(respondWith).not.toHaveBeenCalled();
    }
    expect(runtime.match).not.toHaveBeenCalled(); expect(runtime.fetch).not.toHaveBeenCalled();
});
it("retains cached bootstrap body/headers without a stale response URL", async () => {
    const runtime = worker();
    runtime.match.mockImplementation(async () => {
        const response = new Response("bootstrap", { headers: { "content-type": "application/javascript" } });
        Object.defineProperty(response, "url", { value: "https://local.test/bootstrap.js#first-entry" });
        return response;
    });
    for (const fragment of ["A", "B"]) {
        const respondWith = vi.fn(); runtime.listener.get("fetch")!({ request: { url: `https://local.test/_next/static/chunks/turbopack-worker-entry.js#params=${fragment}`, method: "GET", mode: "same-origin" }, respondWith });
        const response = await respondWith.mock.calls[0][0] as Response;
        expect(response.url).toBe(""); expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("application/javascript"); expect(await response.text()).toBe("bootstrap");
    }
    expect(runtime.fetch).not.toHaveBeenCalled();
});
it("keeps on-demand vendor caching and the small shell precache", async () => {
    const runtime = worker(); let installed: Promise<unknown> | undefined;
    runtime.listener.get("install")!({ waitUntil: promise => { installed = promise; } }); await installed;
    expect(runtime.addAll).toHaveBeenCalledWith(["/", "/discover"]);
    const respondWith = vi.fn(); runtime.listener.get("fetch")!({ request: { url: "https://local.test/vendor/qpdf/12.4.2/qpdf.wasm", method: "GET", mode: "same-origin" }, respondWith });
    await expect(respondWith.mock.calls[0][0]).resolves.toEqual({ cached: true }); expect(runtime.fetch).not.toHaveBeenCalled();
});
