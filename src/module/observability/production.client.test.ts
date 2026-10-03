import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNetworkProvider } from "@/module/analytics/networkProvider";
import { RustLogProvider } from "@/module/log/RustLogProvider";
import { setLogProvider } from "@/module/log/logger";
import { captureError } from "./index";
import { reportClientError, reportNavigation, initializeClientInstrumentation } from "./clientInstrumentation";
import { sendMetric } from "./transport.client";
import { reportClientErrorMetric } from "./errorMetric.client";
import { reportWebVital, WebVitals } from "@/component/common/WebVitals";
import { useReportWebVitals } from "next/web-vitals";

vi.mock("next/web-vitals", () => ({ useReportWebVitals: vi.fn() }));
const fetchMock = vi.fn().mockResolvedValue({});
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "true");
    vi.stubGlobal("window", { location: { pathname: "/tool/image-resizer", href: "https://example.com/?secret" }, addEventListener: vi.fn() });
    vi.stubGlobal("document", { referrer: "https://referrer.example/private?secret" });
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(false) });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear().mockResolvedValue({});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("production providers", () => {
    it("defaults to no network", () => {
        vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", undefined);
        createNetworkProvider().track("tool_opened", { toolId: "image-resizer", slug: "image-resizer" });
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("sends typed events to same origin, omits identity and mode input", () => {
        const provider = createNetworkProvider();
        provider.identify("private-user");
        provider.track("tool_mode_changed", { toolId: "image-resizer", slug: "image-resizer", mode: "private-input" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/metric");
        const options = fetchMock.mock.calls[0][1];
        expect(options).toMatchObject({ keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" });
        expect(options.body).not.toMatch(/private|secret|https/);
        provider.disable();
        provider.track("tool_opened", { toolId: "x", slug: "x" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        provider.enable();
        provider.track("tool_opened", { toolId: "x", slug: "x" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("survives synchronous and asynchronous fetch failures", async () => {
        fetchMock.mockImplementationOnce(() => { throw new Error("offline"); }).mockRejectedValueOnce(new Error("offline"));
        const provider = createNetworkProvider();
        expect(() => provider.track("tool_opened", { toolId: "x", slug: "x" })).not.toThrow();
        expect(() => provider.track("tool_opened", { toolId: "x", slug: "x" })).not.toThrow();
        await Promise.resolve();
    });
    it("network logger strips full URL and sensitive metadata/message", () => {
        new RustLogProvider().log("error", "secret.png failed", { toolId: "image-resizer", filename: "secret.png", originalError: new Error("private"), input: "private" });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toMatchObject({ pathname: "/tool/image-resizer", message: "Client failure", meta: { toolId: "image-resizer" } });
        expect(JSON.stringify(body)).not.toMatch(/secret|private|href|url/);
    });
    it("beacon sends validated vitals with fetch fallback", () => {
        const metric = { name: "CLS", value: 0.1, delta: 0.1, id: "v5-123", entries: [], rating: "good", navigationType: "navigate" } as Parameters<typeof reportWebVital>[0];
        reportWebVital(metric);
        expect(navigator.sendBeacon).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith("/api/metric", expect.objectContaining({ keepalive: true }));
        vi.mocked(navigator.sendBeacon).mockReturnValue(true);
        fetchMock.mockClear();
        reportWebVital(metric);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("keeps a stable Web Vitals callback", () => {
        WebVitals(); WebVitals();
        expect(vi.mocked(useReportWebVitals).mock.calls[0][0]).toBe(vi.mocked(useReportWebVitals).mock.calls[1][0]);
    });
    it("navigation strips query/hash and initial referrer path", () => {
        reportNavigation("/tool/calculator?expr=private#secret");
        reportNavigation("/", "initial");
        const bodies = fetchMock.mock.calls.map(call => JSON.parse(call[1].body));
        expect(bodies[0].pathname).toBe("/tool/calculator");
        expect(bodies[1].referrerHostname).toBe("referrer.example");
        expect(JSON.stringify(bodies)).not.toMatch(/private|secret/);
    });
    it("initializes early listeners and does not duplicate the same captured Error", () => {
        initializeClientInstrumentation();
        expect(window.addEventListener).toHaveBeenCalledWith("error", expect.any(Function));
        expect(window.addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
        const error = new Error("private.png");
        fetchMock.mockClear();
        captureError(error, { boundary: "ToolErrorBoundary" });
        reportClientErrorMetric(error, { failureCategory: "tool-render-error", toolId: "image-resizer" });
        reportClientError(error, "window-error");
        reportClientError(error, "unhandled-rejection");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.filter(call => call[0] === "/api/log")).toHaveLength(1);
        const metric = fetchMock.mock.calls.filter(call => call[0] === "/api/metric");
        expect(metric).toHaveLength(1);
        expect(JSON.parse(metric[0][1].body)).toMatchObject({ type: "client-error", failureCategory: "tool-render-error", toolId: "image-resizer", deviceClass: "unknown" });
        expect(metric[0][1].body).not.toMatch(/private|stack|message|meta/);
    });
    it("global errors/rejections cannot throw even when providers throw", () => {
        setLogProvider({ log() { throw new Error("transport failed"); } });
        expect(() => reportClientError(new Error("private"), "window-error")).not.toThrow();
        expect(() => reportClientError(new Error("private"), "unhandled-rejection")).not.toThrow();
    });
    it("rejects invalid metrics before transport", () => {
        sendMetric({ type: "navigation", timestamp: "invalid", pathname: "/", navigationType: "push" });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
