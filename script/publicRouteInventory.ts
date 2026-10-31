import { getAllTool, getAvailableCategory } from "../src/module/tool/metadata";

const canonicalOrigin = "https://iworkhere.space";

export function getExpectedPublicSitemapUrls(): string[] {
  return [
    `${canonicalOrigin}/`,
    `${canonicalOrigin}/discover`,
    `${canonicalOrigin}/privacy`,
    `${canonicalOrigin}/about`,
    `${canonicalOrigin}/contact`,
    ...getAllTool().map(tool => `${canonicalOrigin}${tool.seo.canonicalPath}`),
    ...getAvailableCategory().map(category => `${canonicalOrigin}/category/${category}`),
    `${canonicalOrigin}/workflows`,
    `${canonicalOrigin}/workflows/prepare-image-for-upload`,
    `${canonicalOrigin}/workflows/heic-photos-to-pdf`,
    `${canonicalOrigin}/workflows/assemble-pdf-packet`,
    `${canonicalOrigin}/workflows/pdf-pages-for-slides`,
    `${canonicalOrigin}/guide`,
  ];
}

export function hasExpectedPublicSitemapUrls(actualUrls: string[]): boolean {
  const expectedUrls = getExpectedPublicSitemapUrls();
  return actualUrls.length === expectedUrls.length
    && new Set(actualUrls).size === actualUrls.length
    && expectedUrls.every(url => actualUrls.includes(url));
}
