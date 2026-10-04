import { describe, it, expect } from "vitest";
import { classifyViewport, isMetricRequest, safePathname, referrerHostname } from "./metric";
import { safeLogMeta, isSafeLogRequest } from "./logSafety";

const base = { timestamp: "2026-10-01T00:00:00Z", pathname: "/tool/image-resizer" };
const valid = { ...base, type: "analytic-event", event: "tool_executed", prop: { toolId: "image-resizer", slug: "image-resizer" } };
describe("telemetry privacy contract", () => {
    it.each([[767, "mobile"], [768, "tablet"], [1023, "tablet"], [1024, "desktop"], [undefined, "unknown"], [NaN, "unknown"], [Infinity, "unknown"], [-1, "unknown"], [0, "unknown"]])("classifies viewport %s as %s", (width, expected) => {
        expect(classifyViewport(width)).toBe(expected);
    });
    it.each(["mobile", "tablet", "desktop", "unknown", undefined])("accepts bounded optional viewport %s", deviceClass => {
        for (const value of [valid, { ...base, type: "navigation", navigationType: "initial" }, { ...base, type: "web-vital", name: "CLS", value: 0, delta: 0, id: "v5" }, { ...base, type: "client-error", failureCategory: "unknown" }]) {
            expect(isMetricRequest({ ...value, deviceClass })).toBe(true);
            expect(isMetricRequest({ ...value, deviceClass: "physical-device" })).toBe(false);
        }
    });
    it("strips query and hash and rejects full URLs", () => {
        expect(safePathname("/tool/calculator?expr=secret#result")).toBe("/tool/calculator");
        expect(safePathname("https://example.com/private?q=secret")).toBe("/");
        expect(safePathname("//example.com/private")).toBe("/");
        expect(referrerHostname("https://example.com/private?secret#hash")).toBe("example.com");
        expect(referrerHostname("blob:private")).toBeUndefined();
    });
    it("accepts the four existing typed events", () => {
        for (const event of ["tool_opened", "tool_executed", "tool_result_copied", "tool_mode_changed"]) expect(isMetricRequest({ ...valid, event })).toBe(true);
    });
    it.each(["filename", "input", "query", "hash", "imageDimensions", "cookies", "url", "unknown"])("rejects arbitrary %s fields", key => {
        expect(isMetricRequest({ ...valid, [key]: "secret" })).toBe(false);
        expect(isMetricRequest({ ...valid, prop: { ...valid.prop, [key]: "secret" } })).toBe(false);
    });
    it("rejects unknown discriminators and unsafe paths", () => {
        expect(isMetricRequest({ ...valid, type: "unknown" })).toBe(false);
        expect(isMetricRequest({ ...valid, pathname: "/tool/calculator?expr=secret" })).toBe(false);
        expect(isMetricRequest({ ...valid, pathname: "/#secret" })).toBe(false);
        expect(isMetricRequest({ ...valid, timestamp: "invalid" })).toBe(false);
    });
    it.each(["LCP", "INP", "CLS", "FCP", "TTFB", "FID"])("accepts %s", name => {
        expect(isMetricRequest({ ...base, type: "web-vital", name, id: "v5-123-456", value: 10, delta: 1, rating: "good", navigationType: "navigate" })).toBe(true);
    });
    it.each([NaN, Infinity, -1, "12"])("rejects malformed metric value %s", value => {
        expect(isMetricRequest({ ...base, type: "web-vital", name: "CLS", id: "metric-1", value, delta: 1 })).toBe(false);
    });
    it("accepts only hostname referrers", () => {
        expect(isMetricRequest({ ...base, type: "navigation", navigationType: "initial", referrerHostname: "example.com" })).toBe(true);
        expect(isMetricRequest({ ...base, type: "navigation", navigationType: "initial", referrerHostname: "https://example.com/private?q=secret" })).toBe(false);
    });
    it("keeps semantic log metadata separate from canonical error serialization", () => {
        const meta = safeLogMeta({ toolId: "image-resizer", filename: "secret.png", input: "secret", file: new File(["private"], "secret.png"), blob: new Blob(["private"]), query: { secret: true }, stack: "Error secret.png\n at user-input (https://example.com/_next/static/chunks/main.js:1:20)\n at blob:secret" });
        expect(meta).toEqual({ toolId: "image-resizer" });
    });
    it("rejects unsafe server logs", () => {
        const log = { ...base, level: "error", message: "Resize worker initialization failed", meta: { boundary: "browser" } };
        expect(isSafeLogRequest(log)).toBe(true);
        expect(isSafeLogRequest({ ...log, message: "Developer-authored warning" })).toBe(true);
        expect(isSafeLogRequest({ ...log, message: "x".repeat(4097) })).toBe(false);
        expect(isSafeLogRequest({ ...log, meta: { filename: "secret.png" } })).toBe(false);
        expect(isSafeLogRequest({ ...log, url: "https://example.com/?private" })).toBe(false);
    });
});
