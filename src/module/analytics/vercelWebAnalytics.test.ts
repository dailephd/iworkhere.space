import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeVercelPageView, vercelWebAnalyticsEnabled } from "./vercelWebAnalytics.client";

afterEach(() => vi.unstubAllEnvs());

describe("Vercel Web Analytics policy", () => {
    it.each([undefined, "false", "TRUE", "1", "arbitrary", " true "])("defaults off for %s", flag => {
        vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED", flag);
        expect(vercelWebAnalyticsEnabled()).toBe(false);
    });
    it("enables only exact true", () => {
        vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED", "true");
        expect(vercelWebAnalyticsEnabled()).toBe(true);
    });
    it.each([
        ["https://example.com/", "https://example.com/"],
        ["/", "/"],
        ["/tool/calculator?expression=private", "/tool/calculator"],
        ["/tool/image-resizer#private", "/tool/image-resizer"],
        ["https://example.com/tool/calculator?q=%E7%A7%81#result", "https://example.com/tool/calculator"],
        ["/category/image?text=%26secret%3Dvalue#secret", "/category/image"],
    ])("sanitizes %s without changing its origin/path", (url, expected) => {
        const event = { type: "pageview", url, filename: "private.png", payload: { text: "private" } };
        expect(sanitizeVercelPageView(event)).toEqual({ type: "pageview", url: expected });
        expect(event.url).toBe(url);
    });
    it.each([null, undefined, "private", {}, { type: "event", url: "/" },
        { type: "pageview", url: 1 }, { type: "pageview", url: "" },
        ...["not a url", "https://[broken", "blob:private", "javascript:private", "//private.example/", "https://user:secret@example.com/", "https:\\example.com", "https://example.com/\nprivate"].map(url => ({ type: "pageview", url })),
    ])("drops unexpected or unsafe input %#", event => {
        expect(sanitizeVercelPageView(event)).toBeNull();
    });
    it("drops input whose accessors throw", () => {
        expect(sanitizeVercelPageView({ get type() { throw new Error("private"); } })).toBeNull();
    });
});
