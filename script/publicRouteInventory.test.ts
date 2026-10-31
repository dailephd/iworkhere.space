import { describe, expect, it } from "vitest";
import sitemap from "../src/app/sitemap";
import { getExpectedPublicSitemapUrls, hasExpectedPublicSitemapUrls } from "./publicRouteInventory";

const origin = "https://iworkhere.space";
const guideRoute = [
  "/guide/assemble-pdf-packet",
  "/guide/prepare-image-for-upload",
  "/guide/heic-photos-to-pdf",
  "/guide/pdf-pages-for-slides",
];

describe("public sitemap route inventory", () => {
  it("expects the 36 canonical public routes, including workflows, privacy, about and contact exactly once", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(expectedUrls).toHaveLength(36);
    expect(new Set(expectedUrls).size).toBe(36);
    expect(expectedUrls.filter(url => url === `${origin}/workflows`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url.includes("/workflows/"))).toEqual([
      `${origin}/workflows/prepare-image-for-upload`,
      `${origin}/workflows/heic-photos-to-pdf`,
      `${origin}/workflows/assemble-pdf-packet`,
      `${origin}/workflows/pdf-pages-for-slides`,
    ]);
    expect(expectedUrls.filter(url => url === `${origin}/privacy`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url === `${origin}/about`)).toHaveLength(1);
    expect(expectedUrls.filter(url => url === `${origin}/contact`)).toHaveLength(1);
    expect(expectedUrls.some(url => url.includes("/api/"))).toBe(false);
    expect(new Set(expectedUrls).size).toBe(expectedUrls.length);
    expect(expectedUrls).toContain(`${origin}/discover`);
    expect(expectedUrls).toContain(`${origin}/tool/json-formatter`);
    expect(expectedUrls).toContain(`${origin}/category/document`);
  });

  it("includes the guide hub exactly once and none of the four redirecting legacy guide routes", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(expectedUrls.filter(url => url === `${origin}/guide`)).toHaveLength(1);
    for (const route of guideRoute) expect(expectedUrls.filter(url => url === `${origin}${route}`)).toHaveLength(0);
    expect(expectedUrls.filter(url => url.startsWith(`${origin}/guide`))).toEqual([`${origin}/guide`]);
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

  it("rejects an inventory that drops a live workflow route or adds an unknown one", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => !url.includes("/workflows/")))).toBe(false);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== `${origin}/workflows/pdf-pages-for-slides`))).toBe(false);
    expect(hasExpectedPublicSitemapUrls([...expectedUrls, `${origin}/workflows/unknown-workflow`])).toBe(false);
  });

  it("rejects the legacy 30-route list, a missing guide hub and any re-added redirecting guide route", () => {
    const expectedUrls = getExpectedPublicSitemapUrls();

    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => !url.includes("/guide")))).toBe(false);
    expect(hasExpectedPublicSitemapUrls(expectedUrls.filter(url => url !== `${origin}/guide`))).toBe(false);
    for (const route of guideRoute) {
      expect(hasExpectedPublicSitemapUrls([...expectedUrls, `${origin}${route}`])).toBe(false);
    }
    expect(hasExpectedPublicSitemapUrls(expectedUrls.map(url => url === `${origin}/discover` ? `${origin}/discover/` : url))).toBe(false);
  });
});
