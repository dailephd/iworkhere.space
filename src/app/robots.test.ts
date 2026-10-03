import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";
import { buildPageMetadata } from "@/lib/seo";

afterEach(() => vi.unstubAllEnvs());

describe("robots and page indexing policy", () => {
    it.each(["production", undefined])("allows Vercel or generic production (%s)", vercel => {
        vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", vercel);
        expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: "https://iworkhere.space/sitemap.xml" });
        expect(buildPageMetadata({ title: "Page", description: "Purpose", canonicalPath: "/" }).robots).toEqual({ index: true, follow: true });
    });
    it.each(["preview", "development"])("prevents indexing and sitemap advertisement for Vercel %s", vercel => {
        vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", vercel);
        expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
        expect(buildPageMetadata({ title: "Page", description: "Purpose", canonicalPath: "/" }).robots).toEqual({ index: false, follow: false });
    });
    it("does not advertise local development", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", undefined);
        expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    });
});
