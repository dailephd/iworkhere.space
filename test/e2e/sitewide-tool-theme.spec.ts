import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixture";

/**
 * Prompt 4 acceptance: the eighteen real tool interiors consume the shared semantic roles in all thirteen appearances.
 * The tool set is derived from the registry-backed sitemap (the registry graph cannot be imported by Playwright).
 * Optional evidence: P04_EVIDENCE_DIR receives tool-ui-coverage.json and appearance-role-matrix.json;
 * P04_SHOT_DIR receives <tool-id|route-id>__<appearance-id>__<viewport-id>__<state>.png and never overwrites one.
 */
type Rgb = [number, number, number];
type ViewportId = "mobile390x844" | "tablet768x1024" | "desktop1440x900";
interface Appearance { id: string; palette: string; mode: "light" | "dark" | "system"; }
interface RoleRow {
    appearance: string; tool: string; element: string; role: string; ok: boolean; detail: string;
}
interface CoverageRow { tool: string; appearance: string; viewport: string; state: string; outcome: string; detail?: string; }

const PALETTE = ["original", "mineral", "oxblood", "signal", "cobalt", "amber"] as const;
const APPEARANCE: Appearance[] = [
    ...PALETTE.flatMap(palette => [
        { id: `${palette}-light`, palette, mode: "light" as const },
        { id: `${palette}-dark`, palette, mode: "dark" as const },
    ]),
    { id: "onedark", palette: "onedark", mode: "system" },
];
const SHOT_APPEARANCE = ["original-light", "original-dark", "onedark"];
const VIEWPORT: Record<ViewportId, { width: number; height: number }> = {
    mobile390x844: { width: 390, height: 844 },
    tablet768x1024: { width: 768, height: 1024 },
    desktop1440x900: { width: 1440, height: 900 },
};
const CATEGORY = ["document", "text", "math", "converter", "time", "image", "developer"] as const;
const evidenceDir = process.env.P04_EVIDENCE_DIR;
// Optional comma-separated tool ids that limit the capture and flow tests to those tools; unset runs all eighteen.
const toolFilter = process.env.P04_TOOLS?.split(",").filter(Boolean);
const wanted = (slug: string) => !toolFilter || toolFilter.includes(slug);
const shotDir = process.env.P04_SHOT_DIR;
const fixture = (name: string) => path.resolve(name);
const pdf = (name: string) => fixture(`test/fixtures/pdf/${name}.pdf`);
const image = (name: string) => fixture(`test/fixtures/images/${name}`);

const coverage: CoverageRow[] = [];
const roleRow: RoleRow[] = [];
function writeEvidence(name: string, rows: unknown[]): void {
    if (!evidenceDir || rows.length === 0) return;
    mkdirSync(evidenceDir, { recursive: true });
    const target = path.join(evidenceDir, name);
    const previous: unknown[] = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : [];
    writeFileSync(target, JSON.stringify([...previous, ...rows], null, 1));
}
test.afterEach(() => {
    writeEvidence("tool-ui-coverage.json", coverage);
    writeEvidence("appearance-role-matrix.json", roleRow);
    coverage.length = 0;
    roleRow.length = 0;
});

async function applyAppearance(page: Page, appearance: Appearance, viewport: ViewportId): Promise<void> {
    await page.setViewportSize(VIEWPORT[viewport]);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(({ palette, mode }) => {
        localStorage.setItem("palette", JSON.stringify(palette));
        localStorage.setItem("theme", JSON.stringify(mode === "system" ? "onedark" : mode));
    }, { palette: appearance.palette, mode: appearance.mode });
}
async function openRoute(page: Page, appearance: Appearance, route: string): Promise<void> {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-palette", appearance.palette);
    await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.id === "onedark" ? "onedark" : appearance.mode);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}
async function shot(page: Page, name: string, toolOnly = false): Promise<void> {
    if (!shotDir) return;
    mkdirSync(shotDir, { recursive: true });
    const file = path.join(shotDir, `${name}.png`);
    if (existsSync(file)) throw new Error(`Screenshot collision, refusing to overwrite ${file}`);
    if (!toolOnly) { await page.screenshot({ path: file, fullPage: true }); return; }
    // Tool captures keep the page header and the whole tool interior, dropping the long guide below so controls stay legible.
    const bottom = await page.locator("[data-tool-ui]").evaluate(node => node.getBoundingClientRect().bottom + window.scrollY);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: Math.ceil(bottom) + 24 } });
}
const appearanceOf = (id: string): Appearance => APPEARANCE.find(one => one.id === id)!;

async function registryToolSlug(request: { get(url: string): Promise<{ text(): Promise<string> }> }): Promise<string[]> {
    const xml = await (await request.get("/sitemap.xml")).text();
    return [...xml.matchAll(/<loc>[^<]*\/tool\/([a-z0-9-]+)<\/loc>/g)].map(match => match[1]).sort();
}

/* ---------- in-page colour measurement ---------- */
interface Measure {
    role: Record<string, Rgb>;
    element: {
        selector: string; kind: string; label: string; disabled: boolean; readonly: boolean; visible: boolean;
        bg: Rgb; fg: Rgb; border: Rgb; borderStyle: string; parentBg: Rgb; contrast: number; borderContrast: number; bgSeparation: number;
    }[];
}
async function measure(page: Page): Promise<Measure> {
    return page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        const rgba = (color: string): [number, number, number, number] => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = "#000";
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const data = context.getImageData(0, 0, 1, 1).data;
            return [data[0], data[1], data[2], data[3] / 255];
        };
        const over = (top: [number, number, number, number], below: [number, number, number]): [number, number, number] =>
            [0, 1, 2].map(i => Math.round(top[i] * top[3] + below[i] * (1 - top[3]))) as [number, number, number];
        const effectiveBg = (element: Element | null): [number, number, number] => {
            const chain: [number, number, number, number][] = [];
            for (let node = element; node; node = node.parentElement) chain.push(rgba(getComputedStyle(node).backgroundColor));
            let result: [number, number, number] = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3) as [number, number, number];
            if (getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)") result = [255, 255, 255];
            for (let i = chain.length - 1; i >= 0; i--) result = over(chain[i], result);
            return result;
        };
        const luminance = (c: [number, number, number]) => {
            const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a: [number, number, number], b: [number, number, number]) => {
            const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };
        const role: Record<string, [number, number, number]> = {};
        for (const name of ["input-bg", "input-border", "panel-bg", "panel-border", "preview-bg", "result-bg", "result-border", "accent", "contrast", "secondary-action-bg", "secondary-action-border", "danger", "danger-soft", "success", "warning", "focus-ring", "text", "text-muted", "card-bg"]) {
            const probe = document.createElement("span");
            probe.style.backgroundColor = `var(--${name})`;
            document.body.appendChild(probe);
            role[name] = rgba(getComputedStyle(probe).backgroundColor).slice(0, 3) as [number, number, number];
            probe.remove();
        }
        const scope = document.querySelector("[data-tool-ui]") ?? document.body;
        const selectors: [string, string][] = [
            ["control", "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select, textarea"],
            ["file", "input[type=file]"],
            ["primary", ".tool-action-primary"],
            ["secondary", ".tool-action-secondary"],
            ["work", ".tool-work"], ["preview", ".tool-preview"], ["result", ".tool-result"], ["feedback", ".tool-feedback"],
        ];
        const element: Measure["element"] = [];
        for (const [kind, selector] of selectors) {
            for (const node of Array.from(scope.querySelectorAll<HTMLElement>(selector))) {
                const style = getComputedStyle(node);
                const box = node.getBoundingClientRect();
                const visible = box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
                const bg = effectiveBg(node);
                const parentBg = effectiveBg(node.parentElement);
                const fg = rgba(style.color).slice(0, 3) as [number, number, number];
                const border = rgba(style.borderTopColor).slice(0, 3) as [number, number, number];
                const label = (node.getAttribute("aria-label") || node.id || node.textContent || kind).trim().slice(0, 40);
                element.push({
                    selector, kind, label, visible,
                    disabled: (node as HTMLInputElement).disabled === true,
                    readonly: (node as HTMLInputElement).readOnly === true,
                    bg, fg, border, borderStyle: style.borderTopStyle, parentBg,
                    contrast: ratio(fg, bg), borderContrast: ratio(border, parentBg),
                    bgSeparation: Math.hypot(bg[0] - parentBg[0], bg[1] - parentBg[1], bg[2] - parentBg[2]),
                });
            }
        }
        return { role, element };
    });
}
const same = (a: Rgb, b: Rgb, tolerance = 2) => a.every((value, index) => Math.abs(value - b[index]) <= tolerance);

/** Checks the measured live interiors against the semantic roles; returns the failures as readable strings. */
function judge(appearance: string, tool: string, measured: Measure): string[] {
    const failures: string[] = [];
    const { role } = measured;
    const record = (element: string, roleName: string, ok: boolean, detail: string) => {
        roleRow.push({ appearance, tool, element, role: roleName, ok, detail });
        if (!ok) failures.push(`${tool}/${element} ${roleName}: ${detail}`);
    };
    for (const item of measured.element.filter(one => one.visible)) {
        const name = `${item.kind}:${item.label}`;
        if (item.kind === "control" || item.kind === "file") {
            if (!item.readonly && !item.disabled) record(name, "input-bg", same(item.bg, role["input-bg"]), `bg ${item.bg} vs ${role["input-bg"]}`);
            if (!item.disabled) record(name, "text-contrast>=4.5", item.contrast >= 4.5, `${item.contrast.toFixed(2)}`);
            // Distinguishable from the enclosing panel: either a 3:1 boundary or a clearly different fill with a visible border.
            const separated = item.borderContrast >= 3 || (item.bgSeparation >= 12 && item.borderContrast >= 1.5);
            record(name, "boundary-vs-panel", separated, `border ${item.borderContrast.toFixed(2)}:1, fill distance ${item.bgSeparation.toFixed(0)}`);
        } else if (item.kind === "primary") {
            if (!item.disabled) {
                record(name, "accent", same(item.bg, role.accent), `bg ${item.bg} vs ${role.accent}`);
                record(name, "text-contrast>=4.5", item.contrast >= 4.5, `${item.contrast.toFixed(2)}`);
            } else {
                record(name, "disabled-not-accent", !same(item.bg, role.accent), `bg ${item.bg}`);
            }
        } else if (item.kind === "secondary") {
            if (!item.disabled) {
                record(name, "secondary-action-bg", same(item.bg, role["secondary-action-bg"]), `bg ${item.bg} vs ${role["secondary-action-bg"]}`);
                record(name, "text-contrast>=4.5", item.contrast >= 4.5, `${item.contrast.toFixed(2)}`);
            } else {
                record(name, "disabled-not-filled", !same(item.bg, role["secondary-action-bg"]) || item.borderStyle === "dashed", `bg ${item.bg}, ${item.borderStyle}`);
            }
        } else if (item.kind === "work") {
            record(name, "panel-bg", same(item.bg, role["panel-bg"]), `bg ${item.bg} vs ${role["panel-bg"]}`);
        } else if (item.kind === "preview") {
            record(name, "preview-bg", same(item.bg, role["preview-bg"]), `bg ${item.bg} vs ${role["preview-bg"]}`);
        } else if (item.kind === "result") {
            record(name, "result-bg", same(item.bg, role["result-bg"]), `bg ${item.bg} vs ${role["result-bg"]}`);
            record(name, "text-contrast>=4.5", item.contrast >= 4.5, `${item.contrast.toFixed(2)}`);
        } else if (item.kind === "feedback") {
            record(name, "text-contrast>=4.5", item.contrast >= 4.5, `${item.contrast.toFixed(2)}`);
        }
    }
    return failures;
}

/* ---------- per-tool real flows ---------- */
interface Flow {
    /** Interactive success path using the real client component and an existing valid fixture. */
    succeed: (page: Page) => Promise<void>;
    /** Real validation or boundary path; omit when the tool has none (recorded NOT_APPLICABLE with the reason). */
    fail?: (page: Page) => Promise<void>;
    notApplicable?: string;
}
const main = (page: Page): Locator => page.getByRole("main");
const mustBeVisibleAlert = async (page: Page, text: RegExp | string) => {
    const alert = main(page).getByRole("alert").filter({ hasText: text }).first();
    await expect(alert).toBeVisible();
    return alert;
};

const FLOW: Record<string, Flow> = {
    "merge-pdf": {
        async succeed(page) {
            await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles([pdf("text-vector"), pdf("rotated")]);
            const merge = page.getByRole("button", { name: "Merge PDF", exact: true });
            await expect(merge).toBeEnabled();
            await merge.click();
            await expect(page.getByRole("heading", { name: "Merged PDF ready", exact: true })).toBeVisible();
            await expect(main(page).locator("a[download].tool-action-primary").first()).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(pdf("encrypted"));
            await mustBeVisibleAlert(page, /Encrypted or password-protected/);
        },
    },
    "split-pdf": {
        async succeed(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
            await page.getByLabel("Pages for output group 1", { exact: true }).fill("1");
            await page.getByRole("button", { name: "Split PDF", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Split PDFs ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("ordering"));
            await page.getByLabel("Pages for output group 1", { exact: true }).fill("999");
            await mustBeVisibleAlert(page, /Enter valid pages/);
            await expect(page.getByRole("button", { name: "Split PDF", exact: true })).toBeDisabled();
        },
    },
    "images-to-pdf": {
        async succeed(page) {
            await page.getByLabel("Choose JPEG or PNG images", { exact: true }).setInputFiles(image("resizer-source.png"));
            await page.getByRole("button", { name: "Create PDF", exact: true }).click();
            await expect(page.getByRole("heading", { name: "PDF ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose JPEG or PNG images", { exact: true }).setInputFiles(pdf("text-vector"));
            await expect(main(page).getByRole("alert").first()).toBeVisible();
        },
    },
    "pdf-to-image": {
        async succeed(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("text-vector"));
            await page.getByRole("button", { name: "Convert pages", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Page images ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("text-vector"));
            await page.getByLabel("Pages to convert", { exact: true }).fill("999");
            await mustBeVisibleAlert(page, /./);
            await expect(page.getByRole("button", { name: "Convert pages", exact: true })).toBeDisabled();
        },
    },
    "compress-pdf": {
        async succeed(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("compression-text-vector"));
            await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Smaller PDF ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose PDF", { exact: true }).setInputFiles(pdf("encrypted"));
            await mustBeVisibleAlert(page, /Encrypted or password-protected/);
        },
    },
    "image-resizer": {
        async succeed(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("resizer-source.png"));
            await page.getByRole("button", { name: "Resize image", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Resized image ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("resizer-source.png"));
            await page.getByLabel("Preserve aspect ratio").uncheck();
            await page.getByLabel("Width", { exact: true }).fill("0");
            await page.getByRole("button", { name: "Resize image", exact: true }).click();
            await expect(main(page).getByRole("alert").first()).toBeVisible();
        },
    },
    "image-compressor": {
        async succeed(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("compressor-source.jpg"));
            await page.getByRole("button", { name: "Compress image", exact: true }).click();
            await expect(page.getByRole("heading", { name: /Compressed image ready|No smaller file produced/ })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
            await expect(main(page).getByRole("alert").first()).toBeVisible();
        },
    },
    "image-converter": {
        async succeed(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("compressor-source.png"));
            await page.getByRole("button", { name: "Convert image", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Converted image ready", exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
            await expect(main(page).getByRole("alert").first()).toBeVisible();
        },
    },
    "heic-converter": {
        async succeed(page) {
            await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles(image("heic-source.heic"));
            const convert = page.getByRole("button", { name: "Convert image", exact: true });
            await expect(convert).toBeEnabled({ timeout: 60_000 });
            await convert.click();
            await expect(page.getByRole("heading", { name: "Converted image ready", exact: true })).toBeVisible({ timeout: 120_000 });
        },
        async fail(page) {
            await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles({ name: "fake.heic", mimeType: "image/heic", buffer: readFileSync(image("compressor-source.jpg")) });
            await expect(main(page).getByRole("alert").first()).toBeVisible({ timeout: 60_000 });
        },
    },
    "slugify": {
        async succeed(page) {
            await page.getByLabel("Text", { exact: true }).fill("Hello, World & Friends!");
            await expect(main(page).getByLabel("Generated slug")).toHaveText("hello-world-friends");
        },
        notApplicable: "Slugify has no validation, boundary or failure path: every string slugifies.",
    },
    "html-text-extractor": {
        async succeed(page) {
            await page.getByLabel("HTML Input", { exact: true }).fill("<p>Hello <b>world</b></p>");
            await page.getByRole("button", { name: "Convert", exact: true }).click();
            await expect(page.getByLabel("Extracted Text", { exact: true })).toHaveValue(/Hello world/);
            await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
        },
        notApplicable: "Extraction never rejects input; the only error is a clipboard failure that needs a denied browser permission.",
    },
    "word-character-counter": {
        async succeed(page) {
            await page.getByLabel("Text", { exact: true }).fill("one two three");
            await expect(main(page).locator("dl").getByText("3", { exact: true }).first()).toBeVisible();
        },
        notApplicable: "Only an over-limit input error exists; covered by the tool's own specs, not a styling state.",
    },
    "calculator": {
        async succeed(page) {
            await page.getByLabel("Expression", { exact: true }).fill("2+3*4");
            await page.getByLabel("Expression", { exact: true }).press("Enter");
            await expect(main(page).locator("output")).toHaveText("14");
        },
        async fail(page) {
            await page.getByLabel("Expression", { exact: true }).fill("2+");
            await page.getByLabel("Expression", { exact: true }).press("Enter");
            await mustBeVisibleAlert(page, /./);
        },
    },
    "length-converter": {
        async succeed(page) {
            await page.getByLabel("Value", { exact: true }).fill("2");
            await expect(main(page).getByText("6.56168").first()).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Value", { exact: true }).fill("");
            await mustBeVisibleAlert(page, /Invalid input/);
        },
    },
    "weight-converter": {
        async succeed(page) {
            await page.getByLabel("Value", { exact: true }).fill("2");
            await expect(main(page).getByText("4.409245").first()).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Value", { exact: true }).fill("");
            await mustBeVisibleAlert(page, /Invalid input/);
        },
    },
    "time-arithmetic": {
        async succeed(page) {
            await page.getByLabel("Time A", { exact: true }).fill("01:50");
            await page.getByLabel("Time B", { exact: true }).fill("00:20");
            await expect(main(page).getByText("02:10", { exact: true })).toBeVisible();
        },
        async fail(page) {
            await page.getByLabel("Time A", { exact: true }).fill("xx");
            await page.getByLabel("Time B", { exact: true }).fill("00:20");
            await expect(main(page).getByText(/Use HH:MM/)).toBeVisible();
        },
    },
    "json-formatter": {
        async succeed(page) {
            await page.getByLabel("JSON input", { exact: true }).fill('{"a":1,"b":[1,2]}');
            await page.getByRole("button", { name: "Format JSON", exact: true }).click();
            await expect(page.getByLabel("JSON output", { exact: true })).toHaveValue(/"a": 1/);
        },
        async fail(page) {
            await page.getByLabel("JSON input", { exact: true }).fill("{bad");
            await page.getByRole("button", { name: "Format JSON", exact: true }).click();
            await mustBeVisibleAlert(page, /./);
        },
    },
    "qr-code-generator": {
        async succeed(page) {
            await page.getByLabel("Text or URL", { exact: true }).fill("https://iworkhere.space");
            await page.getByRole("button", { name: "Generate QR code", exact: true }).click();
            await expect(page.getByAltText("Generated QR code preview")).toBeVisible();
            await expect(main(page).getByRole("link", { name: "Download PNG" })).toBeVisible();
        },
        notApplicable: "Generate is disabled while empty and the encoder reports no other styled failure for ordinary input.",
    },
};

test.describe("eighteen real tool interiors", () => {
    test("the registry-backed sitemap lists exactly the eighteen tools this spec covers", async ({ request }) => {
        const slug = await registryToolSlug(request);
        expect(slug).toHaveLength(18);
        expect(slug).toEqual(Object.keys(FLOW).sort());
    });

    test("canonical sitemap has 36 unique routes and the four live workflow slug routes", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        const loc = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        expect(new Set(loc).size).toBe(36);
        expect(loc.filter(url => /\/workflows\/[^/]+$/.test(url))).toEqual([
            "https://iworkhere.space/workflows/prepare-image-for-upload",
            "https://iworkhere.space/workflows/heic-photos-to-pdf",
            "https://iworkhere.space/workflows/assemble-pdf-packet",
            "https://iworkhere.space/workflows/pdf-pages-for-slides",
        ]);
    });

    // Initial-state baseline: 18 tools x 3 appearances x 2 viewports, with live role judgement. Desktop project only: viewports are set explicitly.
    for (const viewport of ["mobile390x844", "desktop1440x900"] as ViewportId[]) {
        for (const appearanceId of SHOT_APPEARANCE) {
            test(`initial captures and live roles: ${appearanceId} at ${viewport}`, async ({ page, request }, info) => {
                test.skip(info.project.name !== "desktop-chromium", "Viewport is set explicitly; the captures are produced once.");
                test.setTimeout(240_000);
                const appearance = appearanceOf(appearanceId);
                await applyAppearance(page, appearance, viewport);
                const failure: string[] = [];
                for (const slug of (await registryToolSlug(request)).filter(wanted)) {
                    await openRoute(page, appearance, `/tool/${slug}`);
                    await expect(page.locator("[data-tool-ui]")).toBeVisible();
                    const horizontal = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                    expect(horizontal, `${slug} ${viewport} horizontal overflow`).toBeLessThanOrEqual(0);
                    await shot(page, `${slug}__${appearanceId}__${viewport}__initial`, true);
                    const measured = await measure(page);
                    failure.push(...judge(appearanceId, slug, measured));
                    coverage.push({ tool: slug, appearance: appearanceId, viewport, state: "initial", outcome: "captured" });
                }
                expect.soft(failure, `${appearanceId} ${viewport} live interior roles`).toEqual([]);
            });
        }
    }

    // All thirteen resolved appearances, live controls of every tool (desktop viewport).
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: every tool interior consumes the semantic roles`, async ({ page, request }, info) => {
            test.skip(info.project.name !== "desktop-chromium", "Matrix is viewport independent; run once.");
            test.setTimeout(240_000);
            await applyAppearance(page, appearance, "desktop1440x900");
            const failure: string[] = [];
            for (const slug of await registryToolSlug(request)) {
                await openRoute(page, appearance, `/tool/${slug}`);
                failure.push(...judge(appearance.id, slug, await measure(page)));
                // Keyboard focus: the first focusable tool control shows the themed focus outline.
                const first = page.locator("[data-tool-ui]").locator("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])").first();
                await first.focus();
                const outline = await first.evaluate(node => {
                    const style = getComputedStyle(node);
                    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
                });
                if (outline.style === "none" || outline.width < 2) failure.push(`${slug}: first control has no visible focus outline (${outline.style} ${outline.width})`);
            }
            expect.soft(failure, `${appearance.id} roles`).toEqual([]);
        });
    }

    // Real interactions, result/error captures and nested-state judgement.
    for (const slug of Object.keys(FLOW).filter(wanted)) {
        const flow = FLOW[slug];
        for (const [appearanceId, viewport] of [["original-light", "desktop1440x900"], ["onedark", "mobile390x844"]] as [string, ViewportId][]) {
            test(`${slug}: real success${flow.fail ? " and error" : ""} flow in ${appearanceId} at ${viewport}`, async ({ page }, info) => {
                test.setTimeout(240_000);
                const appearance = appearanceOf(appearanceId);
                await applyAppearance(page, appearance, viewport);
                await openRoute(page, appearance, `/tool/${slug}`);
                await flow.succeed(page);
                await page.mouse.move(0, 0); // hover legitimately switches a primary action to the accent-hover role
                const measured = await measure(page);
                const judged = judge(appearanceId, slug, measured);
                expect.soft(judged, `${slug} result-state roles`).toEqual([]);
                if (info.project.name === "desktop-chromium") await shot(page, `${slug}__${appearanceId}__${viewport}__result`, true);
                coverage.push({ tool: slug, appearance: appearanceId, viewport, state: "result", outcome: "passed" });
                if (flow.fail) {
                    await openRoute(page, appearance, `/tool/${slug}`);
                    await flow.fail(page);
                    await page.mouse.move(0, 0);
                    expect.soft(judge(appearanceId, slug, await measure(page)), `${slug} error-state roles`).toEqual([]);
                    if (info.project.name === "desktop-chromium" && appearanceId === "onedark") await shot(page, `${slug}__${appearanceId}__${viewport}__error`, true);
                    coverage.push({ tool: slug, appearance: appearanceId, viewport, state: "error", outcome: "passed" });
                } else {
                    coverage.push({ tool: slug, appearance: appearanceId, viewport, state: "error", outcome: "NOT_APPLICABLE", detail: flow.notApplicable });
                }
            });
        }
    }

    // Correction 2: Slugify shows a result surface only for a real slug; the HEIC source section is on the work-panel tier.
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: HEIC source panel matches the settings panel; Slugify result and no-slug feedback use their roles`, async ({ page }, info) => {
            test.skip(info.project.name !== "desktop-chromium", "Matrix is viewport independent; run once.");
            await applyAppearance(page, appearance, "desktop1440x900");
            const failure: string[] = [];
            const rows: unknown[] = [];

            await openRoute(page, appearance, "/tool/heic-converter");
            const tier = (selector: string) => page.locator(selector).evaluate(node => {
                const s = getComputedStyle(node);
                return { bg: s.backgroundColor, border: s.borderTopColor, width: s.borderTopWidth, radius: s.borderTopLeftRadius, padding: s.paddingTop, shadow: s.boxShadow };
            });
            const source = await tier('section[aria-labelledby="heic-source-title"]');
            const settings = await tier('form[aria-labelledby="heic-controls-title"]');
            if (JSON.stringify(source) !== JSON.stringify(settings)) failure.push(`HEIC source ${JSON.stringify(source)} differs from settings ${JSON.stringify(settings)}`);
            const heic = await measure(page);
            const panel = heic.element.filter(one => one.kind === "work" && one.visible);
            if (panel.length < 2 || panel.some(one => !same(one.bg, heic.role["panel-bg"]))) failure.push("HEIC work panels are not all on --panel-bg");
            failure.push(...judge(appearance.id, "heic-converter", heic));
            rows.push({ appearance: appearance.id, tool: "heic-converter", source, settings, panelCount: panel.length });

            await openRoute(page, appearance, "/tool/slugify");
            const ui = page.locator("[data-tool-ui]");
            const text = page.getByLabel("Text", { exact: true });
            for (const selector of ["output", ".tool-result", '[role="status"]']) {
                if (await ui.locator(selector).count()) failure.push(`Slugify empty state renders ${selector}`);
            }
            await text.fill("Hello World!");
            await expect(ui.getByLabel("Generated slug")).toHaveText("hello-world");
            const slug = await measure(page);
            failure.push(...judge(appearance.id, "slugify", slug));
            rows.push({ appearance: appearance.id, tool: "slugify", state: "result", rows: slug.element.filter(one => one.kind === "result").map(one => ({ bg: one.bg, fg: one.fg, contrast: one.contrast })) });
            await text.fill("!!!");
            await expect(ui.locator("output")).toHaveCount(0);
            await expect(ui.locator(".tool-result")).toHaveCount(0);
            const neutral = await measure(page);
            failure.push(...judge(appearance.id, "slugify", neutral));
            const feedback = neutral.element.filter(one => one.kind === "feedback" && one.visible);
            if (feedback.length !== 1) failure.push(`Slugify no-slug feedback count ${feedback.length}`);
            await text.fill("");
            for (const selector of ["output", ".tool-result", '[role="status"]']) {
                if (await ui.locator(selector).count()) failure.push(`Slugify cleared state still renders ${selector}`);
            }
            rows.push({ appearance: appearance.id, tool: "slugify", state: "no-slug", feedback: feedback.map(one => ({ bg: one.bg, fg: one.fg, contrast: one.contrast })) });
            await info.attach(`computed-roles-${appearance.id}.json`, { body: JSON.stringify(rows, null, 1), contentType: "application/json" });
            expect.soft(failure, `${appearance.id} corrected surfaces`).toEqual([]);
        });
    }

    for (const [appearanceId, viewport] of [["original-light", "desktop1440x900"], ["onedark", "mobile390x844"]] as [string, ViewportId][]) {
        test(`Slugify states, focus and responsive layout in ${appearanceId} at ${viewport}`, async ({ page }, info) => {
            const appearance = appearanceOf(appearanceId);
            await applyAppearance(page, appearance, viewport);
            await openRoute(page, appearance, "/tool/slugify");
            const ui = page.locator("[data-tool-ui]");
            const text = page.getByLabel("Text", { exact: true });
            await expect(text).toBeVisible();
            await expect(ui.locator("output, .tool-result, [role=status]")).toHaveCount(0);
            const box = (await text.boundingBox())!;
            const header = (await page.locator("[data-site-header]").boundingBox())!;
            expect(box.y, "input is not hidden under the fixed header").toBeGreaterThanOrEqual(header.y + header.height - 1);
            expect(box.x + box.width, "input stays inside the viewport").toBeLessThanOrEqual(VIEWPORT[viewport].width);
            await text.focus();
            const outline = await text.evaluate(node => { const s = getComputedStyle(node); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
            expect(outline.style).not.toBe("none");
            expect(outline.width).toBeGreaterThanOrEqual(2);
            await text.fill("Hello World!");
            await expect(ui.getByLabel("Generated slug")).toHaveText("hello-world");
            await expect(ui.getByText("Generated slug", { exact: true })).toBeVisible();
            await text.fill("Ready... Set / Go!");
            await expect(ui.locator("output")).toHaveText("ready-set-go");
            await text.fill("Café 東京");
            await expect(ui.locator("output")).toHaveText("caf");
            await text.fill("Hello World!");
            for (const value of ["東京", "!!!", "   "]) {
                await text.fill(value);
                await expect(ui.locator("output")).toHaveCount(0);
                await expect(ui.locator(".tool-result")).toHaveCount(0);
                await expect(ui.getByRole("status")).toContainText("No slug was generated");
            }
            await text.fill("!!!");
            if (info.project.name === "desktop-chromium") await shot(page, `slugify__${appearanceId}__${viewport}__error`, true);
            await text.fill("");
            await expect(ui.locator("output, .tool-result, [role=status]")).toHaveCount(0);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        });

        test(`HEIC selected-source state keeps its section tiered in ${appearanceId} at ${viewport}`, async ({ page }, info) => {
            const appearance = appearanceOf(appearanceId);
            await applyAppearance(page, appearance, viewport);
            await openRoute(page, appearance, "/tool/heic-converter");
            await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles(image("heic-source.heic"));
            const convert = page.getByRole("button", { name: "Convert image", exact: true });
            await expect(convert).toBeEnabled({ timeout: 60_000 });
            await expect(page.getByRole("region", { name: "Source HEIC image" })).toContainText("480 × 320");
            await expect(page.getByRole("region", { name: "Source HEIC image" })).toContainText("heic-source.heic");
            await expect(page.getByLabel("Choose HEIC image", { exact: true })).toBeVisible();
            await page.mouse.move(0, 0);
            expect(judge(appearanceId, "heic-converter", await measure(page))).toEqual([]);
            if (info.project.name === "desktop-chromium") await shot(page, `heic-converter__${appearanceId}__${viewport}__configured`, true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        });
    }

    // Correction: the shared ImageSourcePanel work stage consumes the work-panel and input roles (resizer, compressor, converter).
    for (const appearance of APPEARANCE) {
        test(`${appearance.id}: the shared image source panel uses the work-panel and input roles`, async ({ page }, info) => {
            test.skip(info.project.name !== "desktop-chromium", "Matrix is viewport independent; run once.");
            await applyAppearance(page, appearance, "desktop1440x900");
            for (const slug of ["image-resizer", "image-compressor", "image-converter"]) {
                await openRoute(page, appearance, `/tool/${slug}`);
                const panel = page.locator("[data-tool-ui] section.tool-work").first();
                await expect(panel, `${slug} source section is a work panel`).toBeVisible();
                const measured = await measure(page);
                const section = measured.element.find(one => one.kind === "work" && one.visible)!;
                expect(same(section.bg, measured.role["panel-bg"]), `${slug} ${appearance.id} source panel bg ${section.bg} vs ${measured.role["panel-bg"]}`).toBe(true);
                const file = measured.element.find(one => one.kind === "file" && one.visible)!;
                expect(same(file.bg, measured.role["input-bg"]), `${slug} ${appearance.id} file input bg`).toBe(true);
                expect(file.contrast, `${slug} ${appearance.id} file text contrast`).toBeGreaterThanOrEqual(4.5);
            }
        });
    }

    test("disabled primary actions stay visibly distinct from enabled ones in all thirteen appearances", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        test.setTimeout(240_000);
        const failure: string[] = [];
        for (const appearance of APPEARANCE) {
            await applyAppearance(page, appearance, "desktop1440x900");
            await openRoute(page, appearance, "/tool/json-formatter");
            await page.getByLabel("JSON input", { exact: true }).fill("x");
            await openRoute(page, appearance, "/tool/qr-code-generator");
            const generate = page.getByRole("button", { name: "Generate QR code", exact: true });
            await expect(generate).toBeDisabled();
            const disabled = await generate.evaluate(node => { const s = getComputedStyle(node); return { bg: s.backgroundColor, style: s.borderTopStyle }; });
            await page.getByLabel("Text or URL", { exact: true }).fill("a");
            const enabled = await generate.evaluate(node => getComputedStyle(node).backgroundColor);
            if (disabled.bg === enabled || disabled.style !== "dashed") failure.push(`${appearance.id}: disabled ${disabled.bg}/${disabled.style} vs enabled ${enabled}`);
        }
        expect(failure).toEqual([]);
    });
});

/* ---------- primary audit responsibilities ---------- */
test.describe("Prompt 4 primary audit issues", () => {
    test("AUD-031: the first usable category card is inside the first 390x844 viewport, with no overflow", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Viewport is explicit; run once.");
        const appearance = appearanceOf("original-light");
        await applyAppearance(page, appearance, "mobile390x844");
        for (const category of CATEGORY) {
            await openRoute(page, appearance, `/category/${category}`);
            const first = main(page).locator('a[href^="/tool/"]').first();
            await expect(first).toBeVisible();
            const box = (await first.boundingBox())!;
            expect(box.y, `${category} first card top`).toBeGreaterThanOrEqual(0);
            expect(box.y + Math.min(box.height, 60), `${category} first card is in the first viewport`).toBeLessThanOrEqual(844);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
            await expect(main(page).getByRole("heading", { name: category === "math" || category === "time" ? "Before you use it" : "Choosing a tool" })).toBeVisible();
            await shot(page, `category-${category}__original-light__mobile390x844__initial`);
        }
    });

    test("AUD-013: the tool category cue resolves to the same canonical category colour as its category page", async ({ page, request }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        const slugOfCategory: Record<string, string> = { "merge-pdf": "document", "slugify": "text", "calculator": "math", "length-converter": "converter", "time-arithmetic": "time", "image-resizer": "image", "json-formatter": "developer" };
        expect((await registryToolSlug(request)).length).toBe(18);
        for (const appearanceId of ["original-light", "onedark"]) {
            const appearance = appearanceOf(appearanceId);
            await applyAppearance(page, appearance, "desktop1440x900");
            for (const [slug, category] of Object.entries(slugOfCategory)) {
                await openRoute(page, appearance, `/tool/${slug}`);
                const cue = page.locator("[data-category-cue]");
                const toolColor = await cue.evaluate(node => getComputedStyle(node).getPropertyValue("--category-color").trim());
                const breadcrumbText = await page.getByRole("navigation", { name: "Breadcrumb" }).innerText();
                await openRoute(page, appearance, `/category/${category}`);
                const categoryColor = await main(page).locator("[data-category]").first().evaluate(node => getComputedStyle(node).getPropertyValue("--category-color").trim());
                expect(toolColor, `${slug} cue colour in ${appearanceId}`).toBe(categoryColor);
                const title = await main(page).getByRole("heading", { level: 1 }).innerText();
                expect(breadcrumbText, `${slug} breadcrumb names ${title}`).toContain(title);
                await openRoute(page, appearance, `/tool/${slug}`);
                await expect(cue).toHaveText(title);
            }
        }
    });

    for (const slug of ["length-converter", "weight-converter"]) {
        test(`AUD-038: ${slug} labels, inputs, selectors and result align at 1440px`, async ({ page }, info) => {
            test.skip(info.project.name !== "desktop-chromium", "Run once.");
            const appearance = appearanceOf("original-light");
            await applyAppearance(page, appearance, "desktop1440x900");
            await openRoute(page, appearance, `/tool/${slug}`);
            const label = (name: string) => page.getByText(name, { exact: true }).first();
            const field = [page.getByLabel("Value", { exact: true }), page.getByLabel("From", { exact: true }), page.getByLabel("To", { exact: true })];
            const box = await Promise.all(field.map(one => one.boundingBox()));
            const labelBox = await Promise.all(["Value", "From", "To"].map(name => label(name).boundingBox()));
            for (const one of box) expect(one).not.toBeNull();
            expect(Math.max(...box.map(one => one!.y)) - Math.min(...box.map(one => one!.y)), "inputs share one row").toBeLessThanOrEqual(1);
            expect(Math.max(...box.map(one => one!.height)) - Math.min(...box.map(one => one!.height)), "equal control height").toBeLessThanOrEqual(1);
            expect(Math.max(...labelBox.map(one => one!.y)) - Math.min(...labelBox.map(one => one!.y)), "labels share one row").toBeLessThanOrEqual(1);
            expect(Math.max(...box.map(one => one!.width)) - Math.min(...box.map(one => one!.width)), "equal control width").toBeLessThanOrEqual(1);
            const result = main(page).getByLabel(/result$/i).first();
            const resultBox = (await result.boundingBox())!;
            expect(Math.abs(resultBox.x - box[0]!.x) - 16, "result card sits inside the same work column").toBeLessThanOrEqual(24);
            expect(resultBox.y).toBeGreaterThan(box[0]!.y + box[0]!.height);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        });
    }

    test("AUD-039: quality is shown only when the selected encoding uses it, with truthful wording", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        const appearance = appearanceOf("original-light");
        await applyAppearance(page, appearance, "desktop1440x900");
        const quality = () => page.locator("[data-tool-ui]").getByText("Quality", { exact: true });

        await openRoute(page, appearance, "/tool/image-converter");
        // A JPEG source can become PNG (lossless, no quality) or WebP (lossy, quality 90 by default).
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("compressor-source.jpg"));
        await expect(page.getByLabel("Output format")).toBeEnabled();
        await page.getByLabel("Output format").selectOption("png");
        await expect(quality()).toHaveCount(0);
        await expect(page.locator("[data-tool-ui]").getByText(/PNG output is lossless, so no quality setting applies/)).toBeVisible();
        await page.getByLabel("Output format").selectOption("webp");
        await expect(quality()).toBeVisible();
        await expect(page.locator("[data-tool-ui]").getByText("Current quality: 90")).toBeVisible();
        await expect(page.locator("[data-tool-ui]").getByText(/lossless, so no quality setting applies/)).toHaveCount(0);

        await openRoute(page, appearance, "/tool/image-compressor");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("compressor-source.png"));
        await expect(quality()).toHaveCount(0);
        await expect(page.locator("[data-tool-ui]").getByText(/PNG uses lossless browser re-encoding/)).toBeVisible();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("compressor-source.jpg"));
        await expect(quality()).toBeVisible();

        await openRoute(page, appearance, "/tool/image-resizer");
        await expect(quality()).toHaveCount(0);
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("resizer-source.png"));
        await expect(page.locator("[data-tool-ui]").getByText(/PNG output is lossless, so no quality setting applies/)).toBeVisible();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(image("resizer-source.jpg"));
        await expect(page.locator("[data-tool-ui]").getByText(/fixed quality of 92; this tool has no quality setting/)).toBeVisible();
        await expect(quality()).toHaveCount(0);

        await openRoute(page, appearance, "/tool/heic-converter");
        await page.getByLabel("Choose HEIC image", { exact: true }).setInputFiles(image("heic-source.heic"));
        await expect(page.getByLabel("Output format")).toBeEnabled({ timeout: 60_000 });
        await expect(quality()).toBeVisible();
        await page.getByLabel("Output format").selectOption("png");
        await expect(quality()).toHaveCount(0);
        await expect(page.locator("[data-tool-ui]").getByText(/PNG output is lossless, so no quality setting applies/)).toBeVisible();
    });

    test("AUD-004: shared page anatomy gives every route one H1, a named main region and a themed section", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        const route: [string, string][] = [
            ["home", "/"], ["discover", "/discover"], ["category-document", "/category/document"], ["tool", "/tool/json-formatter"],
            ["guide", "/guide"], ["workflow-assemble-pdf-packet", "/workflows/assemble-pdf-packet"], ["about", "/about"], ["contact", "/contact"], ["privacy", "/privacy"], ["workflows", "/workflows"],
        ];
        for (const [appearanceId, viewport] of [["original-light", "desktop1440x900"], ["onedark", "mobile390x844"]] as [string, ViewportId][]) {
            const appearance = appearanceOf(appearanceId);
            await applyAppearance(page, appearance, viewport);
            for (const [id, url] of route) {
                await openRoute(page, appearance, url);
                await expect.soft(page.getByRole("heading", { level: 1 }), `${id} has one H1`).toHaveCount(1);
                await expect.soft(page.getByRole("main")).toHaveCount(1);
                const section = await page.getByRole("main").locator("section[aria-labelledby], section[aria-label], [data-home-hero], article").count();
                expect.soft(section, `${id} (${appearanceId}) uses named sections`).toBeGreaterThan(0);
                expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${id} overflow`).toBeLessThanOrEqual(0);
            }
        }
    });
});

/* ---------- protected regressions ---------- */
test.describe("Prompt 2 and 3 protected behavior", () => {
    test("one-row mobile header at most 72px and 18 unique tool links on Home", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        const appearance = appearanceOf("original-light");
        await applyAppearance(page, appearance, "mobile390x844");
        await openRoute(page, appearance, "/");
        const header = (await page.locator("[data-site-header]").boundingBox())!;
        expect(header.height).toBeLessThanOrEqual(72);
        const href = await page.getByRole("main").locator('a[href^="/tool/"]').evaluateAll(link => link.map(one => one.getAttribute("href")));
        expect(new Set(href).size).toBe(18);
    });

    test("One Dark keeps the stored colour mode across a reload", async ({ page }, info) => {
        test.skip(info.project.name !== "desktop-chromium", "Run once.");
        await page.goto("/");
        await page.evaluate(() => { localStorage.setItem("palette", JSON.stringify("onedark")); localStorage.setItem("theme", JSON.stringify("light")); });
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
        expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(JSON.stringify("light"));
    });
});

/* ---------- cross-route captures ---------- */
test.describe("cross-route captures", () => {
    const route: [string, string][] = [
        ["home", "/"], ["discover", "/discover"], ["guide", "/guide"], ["workflow-assemble-pdf-packet", "/workflows/assemble-pdf-packet"],
        ["about", "/about"], ["contact", "/contact"], ["privacy", "/privacy"], ["workflows", "/workflows"],
        ...CATEGORY.map(category => [`category-${category}`, `/category/${category}`] as [string, string]),
    ];
    for (const [appearanceId, viewport] of [["original-dark", "desktop1440x900"], ["onedark", "mobile390x844"]] as [string, ViewportId][]) {
        test(`routes in ${appearanceId} at ${viewport}`, async ({ page }, info) => {
            test.skip(info.project.name !== "desktop-chromium", "Run once.");
            test.setTimeout(180_000);
            const appearance = appearanceOf(appearanceId);
            await applyAppearance(page, appearance, viewport);
            for (const [id, url] of route) {
                await openRoute(page, appearance, url);
                expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${id} overflow`).toBeLessThanOrEqual(0);
                await shot(page, `${id}__${appearanceId}__${viewport}__initial`);
            }
        });
    }
});
