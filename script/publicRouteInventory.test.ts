import { describe, expect, it } from "vitest";
import { getExpectedPublicSitemapUrls, hasExpectedPublicSitemapUrls } from "./publicRouteInventory";

describe("public sitemap route inventory", () => {
  it("expects the 30 canonical public routes, including privacy, about and contact exactly once", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(expectedUrls).toHaveLength(30);
    expect(expectedUrls.filter(url => url === "https://iworkhere.space/privacy")).toHaveLength(1);
    expect(expectedUrls.filter(url => url === "https://iworkhere.space/about")).toHaveLength(1);
    expect(expectedUrls.filter(url => url === "https://iworkhere.space/contact")).toHaveLength(1);
    expect(expectedUrls.some(url => url.includes("/api/"))).toBe(false);
    expect(new Set(expectedUrls).size).toBe(expectedUrls.length);
    expect(expectedUrls).toContain("https://iworkhere.space/discover");
    expect(expectedUrls).toContain("https://iworkhere.space/tool/json-formatter");
    expect(expectedUrls).toContain("https://iworkhere.space/category/document");
  });

  it("accepts the expected inventory and rejects missing, unexpected, or duplicate routes", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(hasExpectedPublicSitemapUrls(expectedUrls)).toBe(true);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== "https://iworkhere.space/privacy"))).toBe(false);
    expect(hasExpectedPublicSitemapUrls([...expectedUrls.slice(1), "https://iworkhere.space/unexpected"])).toBe(false);
    expect(hasExpectedPublicSitemapUrls([...expectedUrls, expectedUrls[0]])).toBe(false);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.map(url => url === "https://iworkhere.space/privacy" ? "https://iworkhere.space/unexpected" : url))).toBe(false);
  });
});
