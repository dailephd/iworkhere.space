import path from "node:path";
import { readFile } from "node:fs/promises";
import { test, expect } from "./support/fixture";
import { inspectCompressedArtifact } from "../compressPdfVerification";
import { getConsoleFailure } from "./support/browserDiagnostic";

const documents = [
    { slug: "merge-pdf", name: "Merge PDF", form: "Merge actions", source: "Source PDFs", picker: "Choose PDFs" },
    { slug: "split-pdf", name: "Split PDF", form: "Split output groups", source: "Source PDF", picker: "Choose PDF" },
    { slug: "images-to-pdf", name: "Images to PDF", form: "Create PDF actions", source: "Source images", picker: "Choose JPEG or PNG images" },
    { slug: "pdf-to-image", name: "PDF to JPG / PNG", form: "Page image settings", source: "Source PDF", picker: "Choose PDF" },
    { slug: "compress-pdf", name: "Compress PDF", form: "Compression actions", source: "Source PDF", picker: "Choose PDF" },
];
const pdf = (name: string) => path.resolve(`test/fixtures/pdf/${name}.pdf`);

test("document family: complete discovery, search, canonical SSR and related navigation", async ({ page, request }) => {
    await page.goto("/");
    const other = page.getByRole("region", { name: "All other tools" });
    for (const tool of documents) await expect(other.locator(`a[href="/tool/${tool.slug}"]`)).toHaveCount(1);
    await other.locator('a[href="/tool/merge-pdf"]').click();
    await expect(page.getByRole("heading", { level: 1, name: "Merge PDF", exact: true })).toBeVisible();
    await page.getByRole("region", { name: "Tool guide" }).getByRole("link", { name: "Split PDF", exact: true }).click();
    await expect(page).toHaveURL(/\/tool\/split-pdf$/);
    await page.goto("/category/document");
    const cards = page.getByRole("main").locator('a[href^="/tool/"]');
    await expect(cards).toHaveText(documents.map(tool => new RegExp(tool.name.replace(/\//g, "\\/"))));
    await cards.filter({ hasText: "Images to PDF" }).click();
    await page.getByRole("region", { name: "Tool guide" }).getByRole("link", { name: "PDF to JPG / PNG", exact: true }).click();
    await expect(page).toHaveURL(/\/tool\/pdf-to-image$/);
    await page.goto("/discover");
    for (const [term, slug] of [["merge", "merge-pdf"], ["split", "split-pdf"], ["images", "images-to-pdf"], ["jpg", "pdf-to-image"], ["png", "pdf-to-image"], ["compress", "compress-pdf"]]) {
        await page.getByLabel("Search", { exact: true }).fill(term);
        await expect(page.getByRole("main").locator(`a[href="/tool/${slug}"]`)).toHaveCount(1);
    }
    await page.getByLabel("Search", { exact: true }).fill("pdf");
    await expect(page.getByRole("main").locator('a[href^="/tool/"]')).toHaveCount(5);
    await page.getByRole("main").locator('a[href="/tool/compress-pdf"]').click();
    await page.getByRole("region", { name: "Tool guide" }).getByRole("link", { name: "Merge PDF", exact: true }).click();
    await expect(page).toHaveURL(/\/tool\/merge-pdf$/);
    const titles: string[] = [], descriptions: string[] = [];
    for (const tool of documents) {
        const html = await (await request.get(`/tool/${tool.slug}`)).text();
        expect(html).toContain(`rel="canonical" href="https://iworkhere.space/tool/${tool.slug}"`);
        expect(html).toContain(`property="og:url" content="https://iworkhere.space/tool/${tool.slug}"`);
        expect(html).toContain("How to use"); expect(html).toContain("Related document tools");
        expect(html).not.toContain("noindex"); expect(html).not.toContain("Related image tools");
        titles.push(html.match(/<title>([^<]+)<\/title>/)![1]);
        descriptions.push(html.match(/name="description" content="([^"]+)"/)![1]);
    }
    expect(new Set(titles).size).toBe(5); expect(new Set(descriptions).size).toBe(5);
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(27);
    for (const route of [...documents.map(tool => `/tool/${tool.slug}`), "/category/document"])
        expect(xml.split(`<loc>https://iworkhere.space${route}</loc>`)).toHaveLength(2);
    expect(xml).not.toMatch(/\/api\/|dashboard|vercel\.app|<loc>[^<]*[?#]/);
});

test("document family: named landmarks, keyboard Reset, wrapping and natural scrolling", async ({ page }, info) => {
    for (const tool of documents) {
        await page.goto(`/tool/${tool.slug}`, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByRole("region", { name: tool.source, exact: true })).toBeVisible();
        await expect(page.getByRole("form", { name: tool.form, exact: true })).toBeVisible();
        const input = page.getByLabel(tool.picker, { exact: true });
        await input.focus(); await expect(input).toBeFocused();
        const reset = page.getByRole("button", { name: "Reset", exact: true });
        await reset.focus(); await reset.press("Enter"); await expect(input).toBeFocused();
        const guide = page.getByRole("region", { name: "Tool guide" });
        await guide.scrollIntoViewIfNeeded(); await expect(guide).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
        await expect(page.getByRole("contentinfo")).toBeVisible();
        await info.attach(`${tool.slug}-composition`, { body: JSON.stringify(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scrollY, height: document.documentElement.scrollHeight }))), contentType: "application/json" });
    }
});

test("document family: PDF source failures preserve bounded accessible feedback", async ({ page }) => {
    for (const tool of documents.filter(value => value.slug !== "images-to-pdf")) {
        await page.goto(`/tool/${tool.slug}`);
        for (const [name, message] of [["encrypted", "Encrypted or password-protected"], ["truncated", "could not be parsed safely"], ["false-signature", "supported PDF header"]]) {
            await page.getByLabel(tool.picker, { exact: true }).setInputFiles(pdf(name));
            const alert = page.getByRole("main").getByRole("alert");
            await expect(alert).toContainText(message); await expect(alert).toBeFocused();
            await expect(page.locator("a[download]")).toHaveCount(0);
            await expect(alert).not.toContainText(/\/input\.pdf|stderr|wasm|pointer|xref/i);
        }
    }
});

test("document family: warmed service worker preserves each operation offline", async ({ page, context }, info) => {
    // Focused tool specs independently verify every output. This lane proves that
    // independently equivalent outputs and real worker operations survive cache reuse.
    const flows = [
        { slug: "merge-pdf", picker: "Choose PDFs", files: [pdf("text-vector"), pdf("rotated")], action: "Merge PDF", result: "Merged PDF ready" },
        { slug: "split-pdf", picker: "Choose PDF", files: [pdf("ordering")], action: "Split PDF", result: "Split PDFs ready" },
        { slug: "images-to-pdf", picker: "Choose JPEG or PNG images", files: [path.resolve("test/fixtures/images/resizer-source.png")], action: "Create PDF", result: "PDF ready" },
        { slug: "pdf-to-image", picker: "Choose PDF", files: [pdf("text-vector")], action: "Convert pages", result: "Page images ready" },
        { slug: "compress-pdf", picker: "Choose PDF", files: [pdf("compression-text-vector")], action: "Compress PDF", result: "Smaller PDF ready" },
    ];
    const methods: string[] = [];
    context.on("request", request => { if (request.url().startsWith("http")) methods.push(request.method()); });
    for (const flow of flows) {
        await page.goto(`/tool/${flow.slug}`);
        await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
        await page.reload(); // Operations begin under an active service worker.
        const execute = async () => {
            await page.getByLabel(flow.picker, { exact: true }).setInputFiles(flow.files);
            if (flow.slug === "split-pdf") await page.getByLabel("Pages for output group 1", { exact: true }).fill("1");
            const action = page.getByRole("button", { name: flow.action, exact: true });
            await expect(action).toBeEnabled(); await action.click();
            await expect(page.getByRole("heading", { name: flow.result, exact: true })).toBeFocused();
            const pending = page.waitForEvent("download");
            await page.getByRole("main").locator("a[download]").first().click();
            const download = await pending, destination = info.outputPath(`${flow.slug}-${Date.now()}-${download.suggestedFilename()}`);
            await download.saveAs(destination); return readFile(destination);
        };
        const online = await execute();
        // Confirm the service-worker cache exists before the warmed operation.
        await expect.poll(async () => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await context.setOffline(true);
        try {
            const offline = await execute();
            if (flow.slug === "pdf-to-image") expect(offline).toEqual(online);
            else expect(await inspectCompressedArtifact(offline)).toEqual(await inspectCompressedArtifact(online));
            if (flow.slug === "compress-pdf") expect(await inspectCompressedArtifact(offline)).toEqual(await inspectCompressedArtifact(await readFile(flow.files[0])));
        } finally { await context.setOffline(false); }
    }
    expect(new Set(methods)).toEqual(new Set(["GET"]));
    await info.attach("document-offline-local-processing", { body: JSON.stringify({ tools: flows.map(value => value.slug), methods: [...new Set(methods)] }), contentType: "application/json" });
});

test("document family: independent cold contexts isolate heavy runtimes on all four routes", async ({ browser }, info) => {
    const evidence: Record<string, string[]> = {};
    for (const route of ["/", "/discover", "/tool/image-converter", "/tool/calculator"]) {
        const context = await browser.newContext(), page = await context.newPage();
        try {
            const urls: string[] = [], scripts: Promise<string>[] = [];
            const failures: string[] = [];
            page.on("pageerror", error => failures.push(error.message));
            page.on("console", message => {
                const failure = getConsoleFailure({ type: message.type(), text: message.text() });
                if (failure) failures.push(failure);
            });
            context.on("request", request => urls.push(request.url()));
            context.on("response", response => { if (response.request().resourceType() === "script") scripts.push(response.text()); });
            await page.goto(route, { waitUntil: "networkidle" });
            expect(urls.filter(url => /vendor\/(pdfjs|qpdf)|pdf\.worker|pdfLib.worker|qpdf.worker|pdfjs-dist/i.test(url))).toEqual([]);
            expect((await Promise.all(scripts)).filter(text => /createQpdfModule|Invalid factory url:|Trying to parse invalid object:|Failed to parse PDF document/.test(text))).toEqual([]);
            expect(failures).toEqual([]);
            evidence[route] = urls.map(url => new URL(url).pathname);
        } finally { await context.close(); }
    }
    await info.attach("document-family-cold-isolation", { body: JSON.stringify(evidence), contentType: "application/json" });
});
