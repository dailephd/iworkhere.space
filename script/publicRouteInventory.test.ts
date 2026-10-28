import { describe, expect, it } from "vitest";
import sitemap from "../src/app/sitemap";
import { getAllTaskGuide } from "../src/module/content/taskGuide";
import { getExpectedPublicSitemapUrls, hasExpectedPublicSitemapUrls } from "./publicRouteInventory";

const origin = "https://iworkhere.space";
const guideRoute = [
  "/guide/assemble-pdf-packet",
  "/guide/prepare-image-for-upload",
  "/guide/heic-photos-to-pdf",
  "/guide/pdf-pages-for-slides",
];

describe("public sitemap route inventory", () => {
  it("expects the 35 canonical public routes, including privacy, about and contact exactly once", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(expectedUrls).toHaveLength(35);
    expect(expectedUrls.filter(url => url === `${origin}/privacy`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url === `${origin}/about`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url === `${origin}/contact`)).toHaveLength(1);
    expect(expectedUrls.some(url => url.includes("/api/"))).toBe(false);
    expect(new Set(expectedUrls).size).toBe(expectedUrls.length);
    expect(expectedUrls).toContain(`${origin}/discover`);
    expect(expectedUrls).toContain(`${origin}/tool/json-formatter`);
    expect(expectedUrls).toContain(`${origin}/category/document`);
  });

  it("includes the guide hub and the four task guide routes exactly once, derived from the task guide records", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(expectedUrls.filter(url => url === `${origin}/guide`)).toHaveLength(1);
    for (const route of guideRoute) expect(expectedUrls.filter(url => url === `${origin}${route}`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url.startsWith(`${origin}/guide`))).toEqual([
      `${origin}/guide`,
      ...getAllTaskGuide().map(guide => `${origin}/guide/${guide.slug}`),
    ]);
    expect(getAllTaskGuide().map(guide => `/guide/${guide.slug}`)).toEqual(guideRoute);
    expect(expectedUrls.some(url => /[?#]|vercel\.app|dashboard/.test(url))).toBe(false);
    expect(expectedUrls.every(url => url.startsWith(`${origin}/`) && !url.endsWith("/index"))).toBe(true);
  });

  it("matches the URLs the application sitemap actually publishes", () => {
    expect(sitemap().map(entry => entry.url)).toEqual(getExpectedPublicSitemapUrls());
  });

  it("accepts the expected inventory and rejects missing, unexpected, or duplicate routes", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(hasExpectedPublicSitemapUrls(expectedUrls)).toBe(true);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== `${origin}/privacy`))).toBe(false);
    expect(hasExpectedPublicSitemapUrls([...expectedUrls.slice(1), `${origin}/unexpected`])).toBe(false);
    expect(hasExpectedPublicSitemapUrls([...expectedUrls, expectedUrls[0]])).toBe(false);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.map(url => url === `${origin}/privacy` ? `${origin}/unexpected` : url))).toBe(false);
  });

  it("rejects the legacy 30-route list and any missing or replaced guide route", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => !url.includes("/guide")))).toBe(false);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== `${origin}/guide`))).toBe(false);
    for (const route of guideRoute) {
      expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== `${origin}${route}`))).toBe(false);
      expect(hasExpectedPublicSitemapUrls(expectedUrls.map(url => url === `${origin}${route}` ? `${origin}${route}?x=1` : url))).toBe(false);
    }
    expect(hasExpectedPublicSitemapUrls(expectedUrls.map(url => url === `${origin}/discover` ? `${origin}/discover/` : url))).toBe(false);
  });
});
