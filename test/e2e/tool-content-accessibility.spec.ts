import { test, expect } from "./support/fixture";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { canonicalUrl, SITE_URL } from "@/lib/seo";

function readRegisteredToolUrls(source: string): string[] {
    const syntaxDiagnostics = ts.transpileModule(source, {
        fileName: "registry.ts",
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
        },
        reportDiagnostics: true,
    }).diagnostics ?? [];
    if (syntaxDiagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
        throw new Error("Registry parser: TypeScript syntax could not be parsed");
    }

    const file = ts.createSourceFile("registry.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declaration = file.statements.find((statement): statement is ts.VariableStatement =>
        ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item =>
            ts.isIdentifier(item.name) && item.name.text === "tool_definition_list"));
    if (!declaration) throw new Error("Registry parser: tool_definition_list declaration was not found");

    const registration = declaration.declarationList.declarations.find(item =>
        ts.isIdentifier(item.name) && item.name.text === "tool_definition_list");
    if (!registration?.initializer || !ts.isArrayLiteralExpression(registration.initializer)) {
        throw new Error("Registry parser: tool_definition_list must be an array literal");
    }

    const readProperties = (object: ts.ObjectLiteralExpression, label: string) => {
        const properties = new Map<string, ts.Expression>();
        for (const member of object.properties) {
            if (!ts.isPropertyAssignment(member)) throw new Error(`Registry parser: unsupported ${label} property`);
            const name = member.name;
            if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) {
                throw new Error(`Registry parser: unsupported ${label} property name`);
            }
            if (properties.has(name.text)) throw new Error(`Registry parser: duplicate ${label}.${name.text}`);
            properties.set(name.text, member.initializer);
        }
        return properties;
    };

    const readString = (properties: Map<string, ts.Expression>, key: string, label: string) => {
        const value = properties.get(key);
        if (!value || !ts.isStringLiteral(value)) throw new Error(`Registry parser: ${label}.${key} must be a string literal`);
        return value.text;
    };

    const ids = new Set<string>();
    const slugs = new Set<string>();
    const paths = new Set<string>();
    const urls = registration.initializer.elements.map((element, index) => {
        if (!ts.isObjectLiteralExpression(element)) throw new Error(`Registry parser: registration ${index + 1} must be an object literal`);
        const properties = readProperties(element, `registration ${index + 1}`);
        const id = readString(properties, "id", `registration ${index + 1}`);
        const slug = readString(properties, "slug", `registration ${index + 1}`);
        const seo = properties.get("seo");
        if (!seo || !ts.isObjectLiteralExpression(seo)) throw new Error(`Registry parser: ${id}.seo must be an object literal`);
        const canonicalPath = readString(readProperties(seo, `${id}.seo`), "canonicalPath", `${id}.seo`);
        if (ids.has(id)) throw new Error(`Registry parser: duplicate tool id ${id}`);
        if (slugs.has(slug)) throw new Error(`Registry parser: duplicate tool slug ${slug}`);
        if (paths.has(canonicalPath)) throw new Error(`Registry parser: duplicate canonical path ${canonicalPath}`);
        if (!canonicalPath.startsWith("/tool/") || canonicalPath !== `/tool/${slug}`) {
            throw new Error(`Registry parser: ${id} canonical path does not match its tool slug`);
        }
        ids.add(id);
        slugs.add(slug);
        paths.add(canonicalPath);
        return canonicalUrl(canonicalPath);
    });

    return urls;
}

function registryToolUrls(): string[] {
    const source = readFileSync(resolve(process.cwd(), "src/module/tool/registry.ts"), "utf8");
    return readRegisteredToolUrls(source);
}

async function discoverToolUrls(page: Page): Promise<string[]> {
    expect((await page.goto("/discover", { waitUntil: "networkidle" }))?.status()).toBe(200);
    const links = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(links).toHaveCount(18);
    const paths = await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")!));
    return paths.map(path => canonicalUrl(path));
}

function expectToolRouteInventories(expected: string[], discoverUrls: string[], sitemapUrls: string[]) {
    expect(expected).toHaveLength(18);
    expect(new Set(expected).size).toBe(expected.length);
    expect(new Set(discoverUrls).size).toBe(discoverUrls.length);
    expect(new Set(sitemapUrls).size).toBe(sitemapUrls.length);

    const validateCanonicalUrls = (urls: string[]) => urls.map(value => {
        const url = new URL(value);
        expect(url.origin).toBe(SITE_URL);
        expect(url.search).toBe("");
        expect(url.hash).toBe("");
        expect(value).toBe(canonicalUrl(url.pathname));
        return url;
    });
    const discoverParsed = validateCanonicalUrls(discoverUrls);
    const sitemapParsed = validateCanonicalUrls(sitemapUrls);
    for (const url of sitemapParsed) {
        expect(url.pathname).not.toMatch(/^\/(?:api|dashboard|_not-found)(?:\/|$)/);
    }

    const discoverTools = discoverUrls.filter((_, index) => discoverParsed[index].pathname.startsWith("/tool/"));
    const sitemapTools = sitemapUrls.filter((_, index) => sitemapParsed[index].pathname.startsWith("/tool/"));
    expect(discoverTools).toHaveLength(18);
    expect(sitemapTools).toHaveLength(18);
    expect([...discoverTools].sort()).toEqual([...expected].sort());
    expect([...sitemapTools].sort()).toEqual([...expected].sort());
}

const cases = [
    { slug: "slugify", name: "Slugify Text", section: ["Turn a title into a slug", "ASCII handling and empty results", "Check the destination"], related: ["html-text-extractor", "word-character-counter"] },
    { slug: "length-converter", name: "Length Converter", section: ["Convert a length", "Supported length units", "Rounding and numeric input"], related: ["weight-converter", "calculator"] },
    { slug: "weight-converter", name: "Weight Converter", section: ["Convert a mass", "Supported mass units", "Rounding and numeric input"], related: ["length-converter", "calculator"] },
    { slug: "html-text-extractor", name: "HTML Text Extractor", section: ["Extract text from HTML", "Line breaks and whitespace", "Extraction limits"], related: ["word-character-counter", "slugify"] },
];

for (const tool of cases) {
    test(`${tool.slug}: server guide, related links and working controls fit the viewport`, async ({ page, request, context }, testInfo) => {
        const response = await request.get(`/tool/${tool.slug}`);
        expect(response.status()).toBe(200);
        const html = await response.text();
        for (const heading of ["How to use", ...tool.section]) expect(html).toContain(heading);
        expect(html).toContain(`rel="canonical" href="https://iworkhere.space/tool/${tool.slug}"`);
        expect((await page.goto(`/tool/${tool.slug}`, { waitUntil: "networkidle" }))?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1, name: tool.name, exact: true })).toBeVisible();
        const main = page.getByRole("main");
        const guide = page.getByRole("region", { name: "Tool guide" });
        await expect(guide.getByRole("heading", { name: "How to use", exact: true })).toBeVisible();
        for (const heading of tool.section) await expect(guide.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        const links = guide.getByRole("link");
        await expect(links).toHaveCount(tool.related.length);
        for (const [index, id] of tool.related.entries()) {
            await expect(links.nth(index)).toHaveAttribute("href", `/tool/${id}`);
            expect((await request.get(`/tool/${id}`)).status()).toBe(200);
        }

        if (tool.slug === "slugify") {
            const input = main.getByRole("textbox", { name: "Text", exact: true });
            await expect(input).toHaveAttribute("id", "slugify-input");
            await expect(input).toHaveAttribute("placeholder", "Enter text");
            await expect(main.locator('label[for="slugify-input"]')).toBeVisible();
            await main.locator('label[for="slugify-input"]').click();
            await expect(input).toBeFocused();
            await page.keyboard.press("Shift+Tab");
            await page.keyboard.press("Tab");
            await expect(input).toBeFocused();
            expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
            await page.keyboard.type("Hello World!");
            await expect(main.locator("output")).toHaveText("hello-world");
            for (const [value, expected] of [["Ready... Set / Go!", "ready-set-go"], ["Café 東京", "caf"], ["東京", ""], ["!!!", ""], ["", ""]]) {
                await input.fill(value); await expect(main.locator("output")).toHaveText(expected);
            }
        } else if (tool.slug === "html-text-extractor") {
            await context.grantPermissions(["clipboard-read", "clipboard-write"]);
            await main.getByLabel("HTML Input", { exact: true }).fill("<p>Hello <strong>world</strong><br>Next line</p><script>ignored()</script>");
            await main.getByRole("button", { name: "Convert", exact: true }).click();
            await expect(main.getByLabel("Extracted Text", { exact: true })).toHaveValue("Hello world\nNext line");
            await main.getByRole("button", { name: "Copy", exact: true }).click();
            await expect(main.getByRole("button", { name: "Copied!", exact: true })).toBeVisible();
            // Windows clipboard text uses CRLF; compare the copied text's logical lines.
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            expect(copied.replace(/\r\n/g, "\n")).toBe("Hello world\nNext line");
        } else {
            const length = tool.slug === "length-converter";
            const result = main.locator("div.text-2xl");
            await expect(result).toHaveText(length ? "3.28084 ft" : "2.204623 lb");
            await main.getByLabel("Value", { exact: true }).fill("2");
            await main.getByLabel("From", { exact: true }).selectOption(length ? "km" : "lb");
            await main.getByLabel("To", { exact: true }).selectOption(length ? "m" : "oz");
            await expect(result).toHaveText(length ? "2000 m" : "32 oz");
            await main.getByLabel("Value", { exact: true }).fill("");
            await expect(result).toContainText("Invalid input");
        }

        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        const clipped = await main.locator("input, select, textarea, button").evaluateAll(elements => elements.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.left < 0 || rect.right > document.documentElement.clientWidth;
        }).map(el => el.id || el.textContent));
        expect(clipped).toEqual([]);
        await expect(page.locator('script[src*="googlesyndication"], ins.adsbygoogle')).toHaveCount(0);
        await testInfo.attach(`${tool.slug}-final-page`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
}

test("guide additions preserve the registered sitemap inventory", async ({ page, request }) => {
    const expected = registryToolUrls();
    const discover = await discoverToolUrls(page);
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]);
    expectToolRouteInventories(expected, discover, urls);
    for (const tool of cases) expect(xml.split(`<loc>https://iworkhere.space/tool/${tool.slug}</loc>`)).toHaveLength(2);
});

test("sitemap tool inventory tolerates informational routes and rejects tool regressions", async ({ page, request }, testInfo) => {
    const expected = registryToolUrls();
    const discover = await discoverToolUrls(page);
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const baseline = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]);
    const firstTool = expected[0];
    expectToolRouteInventories(expected, discover, baseline);
    const privacy = canonicalUrl("/privacy");
    const withPrivacy = baseline.includes(privacy) ? baseline : [...baseline, privacy];
    expectToolRouteInventories(expected, discover, withPrivacy);
    const informational = canonicalUrl("/about");
    const withInformational = withPrivacy.includes(informational) ? withPrivacy : [...withPrivacy, informational];
    expectToolRouteInventories(expected, discover, withInformational);

    const replacedUrl = canonicalUrl("/tool/unregistered-tool");
    const missingSitemapRoute = baseline.filter(url => url !== firstTool);
    const missingDiscoverRoute = discover.filter(url => url !== firstTool);
    const unexpectedSitemapRoute = [...baseline, replacedUrl];
    const unexpectedDiscoverRoute = [...discover, replacedUrl];
    const replacedSitemapRoute = baseline.map(url => url === firstTool ? replacedUrl : url);
    const replacedDiscoverRoute = discover.map(url => url === firstTool ? replacedUrl : url);
    const duplicateToolRoute = [...baseline, firstTool];
    const duplicateNonToolRoute = [...baseline, canonicalUrl("/")];

    expect(() => expectToolRouteInventories(expected, discover, missingSitemapRoute)).toThrow();
    expect(() => expectToolRouteInventories(expected, missingDiscoverRoute, baseline)).toThrow();
    expect(() => expectToolRouteInventories(expected, discover, unexpectedSitemapRoute)).toThrow();
    expect(() => expectToolRouteInventories(expected, unexpectedDiscoverRoute, baseline)).toThrow();
    const replacedSitemapTools = replacedSitemapRoute.filter(url => new URL(url).pathname.startsWith("/tool/"));
    expect([...replacedDiscoverRoute].sort()).toEqual([...replacedSitemapTools].sort());
    expect([...replacedDiscoverRoute].sort()).not.toEqual([...expected].sort());
    expect(() => expectToolRouteInventories(expected, replacedDiscoverRoute, replacedSitemapRoute)).toThrow();
    expect(() => expectToolRouteInventories(expected, discover, duplicateToolRoute)).toThrow();
    expect(() => expectToolRouteInventories(expected, discover, duplicateNonToolRoute)).toThrow();
    expect(() => readRegisteredToolUrls('export const tool_definition_list = [;')).toThrow(/syntax could not be parsed/);
    expect(readRegisteredToolUrls('export const tool_definition_list = [{ id: "valid", slug: "valid", seo: { canonicalPath: "/tool/valid" } }];'))
        .toEqual([canonicalUrl("/tool/valid")]);
    expect(() => readRegisteredToolUrls('export const tool_definition_list = [{ id: "bad", slug: "bad", seo: {} }];')).toThrow(/canonicalPath/);

    await testInfo.attach("sitemap-inventory-proof", {
        body: JSON.stringify({ expectedToolUrls: expected, discover, baseline, withPrivacy, withInformational,
            sharedReplacement: { discover: replacedDiscoverRoute, sitemap: replacedSitemapRoute, rejected: true },
            rejected: ["missing Discover tool", "missing sitemap tool", "unexpected Discover tool", "unexpected sitemap tool", "shared same-count tool replacement", "duplicate tool", "duplicate non-tool", "uninterpretable registry entry"] }, null, 2),
        contentType: "application/json",
    });
});
