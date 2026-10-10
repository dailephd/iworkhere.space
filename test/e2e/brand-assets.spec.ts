import { readFileSync } from "node:fs";
import { test, expect } from "./support/fixture";

const faviconSizes = [16, 24, 32, 48, 64, 96, 128];

function readIcoSizes(data: Buffer): Array<{ width: number; height: number }> {
    expect(data.readUInt16LE(0)).toBe(0);
    expect(data.readUInt16LE(2)).toBe(1);
    const count = data.readUInt16LE(4);
    return Array.from({ length: count }, (_, index) => {
        const offset = 6 + index * 16;
        return {
            width: data[offset] || 256,
            height: data[offset + 1] || 256,
        };
    });
}

test("browser favicon uses the Le SVG and supplied ICO at required display sizes", async ({ page, request }, testInfo) => {
    await page.goto("/");

    const iconLinks = await page.locator('link[rel="icon"]').evaluateAll(elements => elements.map(element => {
        const link = element as HTMLLinkElement;
        return { path: new URL(link.href).pathname, type: link.type };
    }));
    expect(iconLinks.some(link => link.path === "/icon.svg")).toBe(true);
    expect(iconLinks.some(link => link.path === "/favicon.ico")).toBe(true);

    const svgLink = iconLinks.find(link => link.path === "/icon.svg");
    const svgResponse = await request.get(svgLink!.path);
    expect(svgResponse.status()).toBe(200);
    expect(await svgResponse.text()).toContain("Le — transform utility mark");

    const faviconResponse = await request.get("/favicon.ico");
    expect(faviconResponse.status()).toBe(200);
    expect(faviconResponse.headers()["content-type"]).toMatch(/icon/i);
    const favicon = await faviconResponse.body();
    expect(favicon).toEqual(readFileSync("src/app/favicon.ico"));
    const suppliedSizes = readIcoSizes(favicon);
    expect(suppliedSizes).toEqual(expect.arrayContaining([
        { width: 16, height: 16 },
        { width: 24, height: 24 },
        { width: 32, height: 32 },
        { width: 48, height: 48 },
        { width: 64, height: 64 },
    ]));

    const renders = await page.evaluate(async sizes => {
        const image = new Image();
        image.src = "/favicon.ico";
        await image.decode();
        const proof = document.createElement("div");
        proof.id = "favicon-size-proof";
        proof.style.cssText = "display:flex;align-items:flex-end;gap:12px;padding:16px;background:#e5e7eb;width:max-content";
        const rendered = sizes.map(size => {
            const frame = document.createElement("div");
            frame.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;font:12px sans-serif;color:#111827";
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Canvas 2D context is unavailable");
            context.drawImage(image, 0, 0, size, size);
            const pixels = context.getImageData(0, 0, size, size).data;
            let foregroundPixels = 0;
            for (let offset = 0; offset < pixels.length; offset += 4) {
                const [red, green, blue, alpha] = pixels.slice(offset, offset + 4);
                if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) foregroundPixels++;
            }
            const label = document.createElement("span");
            label.textContent = `${size}px`;
            frame.append(canvas, label);
            proof.append(frame);
            return { size, width: canvas.width, height: canvas.height, foregroundPixels };
        });
        document.body.append(proof);
        return rendered;
    }, faviconSizes);
    expect(renders.map(render => render.size)).toEqual(faviconSizes);
    for (const render of renders) {
        expect(render.width).toBe(render.size);
        expect(render.height).toBe(render.size);
        expect(render.foregroundPixels).toBeGreaterThan(0);
    }
    await testInfo.attach("favicon-render-sizes", {
        body: await page.locator("#favicon-size-proof").screenshot(),
        contentType: "image/png",
    });
});

test("PWA manifest icon paths resolve and maskable art stays inside the safe circle", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.icons).toEqual([
        { src: "/icon/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);

    const dimensions = await page.evaluate(async (icons: Array<{ src: string }>) => Promise.all(icons.map(icon => new Promise<{ src: string; width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ src: icon.src, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error(`Manifest icon failed to load: ${icon.src}`));
        image.src = icon.src;
    }))), manifest.icons);
    expect(dimensions).toEqual([
        { src: "/icon/icon-192.png", width: 192, height: 192 },
        { src: "/icon/icon-512.png", width: 512, height: 512 },
        { src: "/icon/icon-maskable.png", width: 512, height: 512 },
    ]);
    for (const icon of manifest.icons) {
        const response = await request.get(icon.src);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("image/png");
    }

    const safeArea = await page.evaluate(async () => {
        const image = new Image();
        image.src = "/icon/icon-maskable.png";
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D context is unavailable");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const center = canvas.width / 2;
        const radius = canvas.width * 0.4;
        let foregroundPixels = 0;
        let outsideSafeArea = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const offset = (y * canvas.width + x) * 4;
                const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2], alpha = pixels[offset + 3];
                if (alpha > 200 && (red < 245 || green < 245 || blue < 245)) {
                    foregroundPixels++;
                    if (Math.hypot(x + 0.5 - center, y + 0.5 - center) > radius) outsideSafeArea++;
                }
            }
        }
        return { width: canvas.width, height: canvas.height, foregroundPixels, outsideSafeArea };
    });
    expect(safeArea.width).toBe(512);
    expect(safeArea.height).toBe(512);
    expect(safeArea.foregroundPixels).toBeGreaterThan(0);
    expect(safeArea.outsideSafeArea).toBe(0);
});

for (const theme of ["light", "dark", "onedark"] as const) {
    test(`${theme}: Le header mark, wordmark, navigation and keyboard layout remain accessible`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === "mobile-chromium";
        await page.addInitScript(id => localStorage.setItem("theme", JSON.stringify(id)), theme);
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        const header = page.getByRole("banner");
        const brand = header.getByRole("link", { name: "iworkhere.space", exact: true });
        const mark = brand.locator("svg");
        const navigation = header.getByRole("navigation", { name: "Primary navigation", exact: true });
        await expect(brand).toBeVisible();
        await expect(mark).toHaveAttribute("viewBox", "0 0 365 435");
        await expect(mark).toHaveAttribute("aria-hidden", "true");
        await expect(mark.locator("path[data-logo-part]")).toHaveCount(4);
        await expect(navigation).toBeVisible();
        await expect(header.getByRole("link", { name: "Search tools", exact: true })).toBeVisible();
        await expect(header.getByRole("button", { name: "Themes", exact: true })).toBeEnabled();

        const geometry = await page.evaluate(() => {
            const headerElement = document.querySelector("header")!;
            const link = headerElement.querySelector('a[href="/"]')!;
            const svg = link.querySelector("svg")!;
            const headerStyle = getComputedStyle(headerElement);
            const background = headerStyle.backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
            const ratio = (background: number[]) => {
                const luminance = background.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
                const l = luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722;
                return 1.05 / (l + 0.05);
            };
            const box = svg.getBoundingClientRect();
            return {
                headerBackground: headerStyle.backgroundColor,
                whiteMarkContrast: ratio(background),
                markLeft: box.left,
                markRight: box.right,
                viewportWidth: window.innerWidth,
                horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            };
        });
        expect(geometry.whiteMarkContrast).toBeGreaterThanOrEqual(3);
        expect(geometry.markLeft).toBeGreaterThanOrEqual(0);
        expect(geometry.markRight).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.horizontalOverflow).toBe(false);

        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Skip to main content", exact: true })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(brand).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(navigation.getByRole("link").first()).toBeFocused();
        await testInfo.attach(`${theme}-${mobile ? "mobile" : "desktop"}-header`, {
            body: await header.screenshot(),
            contentType: "image/png",
        });
    });
}
