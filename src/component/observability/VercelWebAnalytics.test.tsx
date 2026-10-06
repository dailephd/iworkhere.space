import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Analytics } from "@vercel/analytics/next";
import { VercelWebAnalytics } from "./VercelWebAnalytics";
import { sanitizeVercelPageView } from "@/module/analytics/vercelWebAnalytics.client";

vi.mock("@vercel/analytics/next", () => ({ Analytics: vi.fn(() => null) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("does not mount the SDK when disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED", undefined);
    expect(renderToStaticMarkup(<VercelWebAnalytics />)).toBe("");
    expect(Analytics).not.toHaveBeenCalled();
});
it("mounts one invisible SDK integration with only the beforeSend policy", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED", "true");
    expect(renderToStaticMarkup(<VercelWebAnalytics />)).toBe("");
    expect(Analytics).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Analytics).mock.calls[0][0]).toEqual({ beforeSend: sanitizeVercelPageView });
});
