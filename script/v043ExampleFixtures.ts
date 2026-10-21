import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { chromium, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { inspectCompressedArtifact } from "../test/compressPdfVerification";

/**
 * Repeatable generator for the v0.4.3 demonstration assets.
 *
 * Sources are drawn by this file (PDFs with pdf-lib, PNGs with a tiny rasterizer, the JPEG with the browser canvas).
 * Every output is then produced by driving the real, built tool UI in Chromium and saving its actual download.
 * Nothing here processes a file in place of a tool. Run against `npm run start`:
 *   npx tsx script/v043ExampleFixtures.ts --base-url http://127.0.0.1:3100 [--overwrite]
 */

export const EXAMPLE_ROOT = "public/examples/v0.4.3";
export type ExampleStep =
    | { kind: "choose-files"; control: string; asset: string[] }
    | { kind: "set-text"; control: string; value: string }
    | { kind: "choose-option"; control: string; value: string }
    | { kind: "press-button"; control: string; waitForHeading: string }
    | { kind: "download"; control: string; filename: string; saveAs: string };
export interface ExampleOperation { id: string; exampleId: string; toolId: string; summary: string; step: ExampleStep[] }
export interface ExampleAssetFact {
    path: string; exampleId: string; role: "source" | "output"; operation: string | null; mediaType: string; bytes: number; sha256: string;
    width?: number; height?: number; pageCount?: number; page?: { width: number; height: number; rotation: number }[];
}
export interface ExampleManifest { schema: "iworkhere.space/value-examples/1"; version: "0.4.3"; operation: ExampleOperation[]; asset: ExampleAssetFact[] }

/* ---------- Deterministic raster sources ---------- */
type Color = [number, number, number, number];
export class Raster {
    readonly data: Uint8Array;
    constructor(readonly width: number, readonly height: number, fill: Color) {
        this.data = new Uint8Array(width * height * 4);
        this.rect(0, 0, width, height, fill);
    }
    rect(x: number, y: number, w: number, h: number, color: Color) {
        for (let row = Math.max(0, y); row < Math.min(this.height, y + h); row++) {
            for (let column = Math.max(0, x); column < Math.min(this.width, x + w); column++) this.data.set(color, (row * this.width + column) * 4);
        }
    }
    circle(cx: number, cy: number, radius: number, color: Color) {
        for (let row = cy - radius; row <= cy + radius; row++) for (let column = cx - radius; column <= cx + radius; column++) {
            if ((column - cx) ** 2 + (row - cy) ** 2 <= radius ** 2) this.rect(column, row, 1, 1, color);
        }
    }
    triangle(a: [number, number], b: [number, number], c: [number, number], color: Color) {
        const side = (p: [number, number], q: [number, number], x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
            const s1 = side(a, b, x, y), s2 = side(b, c, x, y), s3 = side(c, a, x, y);
            if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) this.rect(x, y, 1, 1, color);
        }
    }
    /** Seven-segment numeral in a box; only 1 and 2 are needed to make page order unambiguous. */
    numeral(digit: 1 | 2, x: number, y: number, w: number, h: number, t: number, color: Color) {
        const top: [number, number, number, number] = [x, y, w, t], middle: [number, number, number, number] = [x, y + (h - t) / 2, w, t], bottom: [number, number, number, number] = [x, y + h - t, w, t];
        const upperRight: [number, number, number, number] = [x + w - t, y, t, h / 2 + t / 2], lowerRight: [number, number, number, number] = [x + w - t, y + h / 2, t, h / 2];
        const lowerLeft: [number, number, number, number] = [x, y + h / 2, t, h / 2];
        for (const segment of digit === 1 ? [upperRight, lowerRight] : [top, upperRight, middle, lowerLeft, bottom]) this.rect(...segment, color);
    }
}
function crc32(bytes: Uint8Array): number {
    let value = ~0;
    for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
    return ~value >>> 0;
}
/** RGBA, filter 0, fixed zlib level: a small PNG writer that keeps the source scene explicit. */
export function encodePng(raster: Raster): Uint8Array {
    const chunk = (type: string, body: Uint8Array) => {
        const out = Buffer.alloc(12 + body.length), name = Buffer.from(type, "latin1");
        out.writeUInt32BE(body.length, 0); name.copy(out, 4); Buffer.from(body).copy(out, 8);
        out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
        return out;
    };
    const header = Buffer.alloc(13); header.writeUInt32BE(raster.width, 0); header.writeUInt32BE(raster.height, 4); header.set([8, 6, 0, 0, 0], 8);
    const row = raster.width * 4, scan = Buffer.alloc((row + 1) * raster.height);
    for (let y = 0; y < raster.height; y++) scan.set(raster.data.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(scan, { level: 9 })), chunk("IEND", new Uint8Array())]);
}
const OPAQUE = (r: number, g: number, b: number): Color => [r, g, b, 255];
const CLEAR: Color = [0, 0, 0, 0];

export function resizerSourceScene(): Raster {
    const scene = new Raster(800, 600, OPAQUE(244, 241, 234));
    for (let x = 0; x <= 800; x += 100) scene.rect(x - 1, 0, 2, 600, OPAQUE(217, 211, 196));
    for (let y = 0; y <= 600; y += 100) scene.rect(0, y - 1, 800, 2, OPAQUE(217, 211, 196));
    scene.circle(400, 300, 170, OPAQUE(109, 40, 217)); scene.circle(400, 300, 90, OPAQUE(244, 241, 234));
    scene.triangle([120, 480], [300, 480], [210, 330], OPAQUE(29, 78, 216)); scene.rect(560, 380, 160, 110, OPAQUE(42, 157, 143));
    scene.rect(24, 24, 80, 80, OPAQUE(214, 40, 40)); scene.rect(696, 24, 80, 80, OPAQUE(42, 157, 143));
    scene.rect(24, 496, 80, 80, OPAQUE(29, 78, 216)); scene.rect(696, 496, 80, 80, OPAQUE(244, 180, 0));
    for (const [x, y, w, h] of [[0, 0, 800, 8], [0, 592, 800, 8], [0, 0, 8, 600], [792, 0, 8, 600]]) scene.rect(x, y, w, h, OPAQUE(34, 34, 51));
    return scene;
}
export function converterSourceScene(): Raster {
    const scene = new Raster(480, 320, CLEAR);
    scene.circle(140, 160, 100, OPAQUE(230, 57, 70)); scene.circle(140, 160, 40, CLEAR);
    scene.rect(260, 40, 180, 110, OPAQUE(29, 78, 216));
    scene.triangle([350, 170], [270, 290], [430, 290], OPAQUE(42, 157, 143));
    return scene;
}
export function imagesToPdfFirstScene(): Raster {
    const scene = new Raster(400, 300, CLEAR);
    scene.rect(24, 24, 352, 252, OPAQUE(249, 115, 22)); scene.numeral(1, 150, 60, 100, 180, 28, OPAQUE(255, 255, 255));
    return scene;
}
export function imagesToPdfSecondScene(): Raster {
    const scene = new Raster(320, 400, OPAQUE(15, 118, 110));
    scene.numeral(2, 90, 80, 140, 240, 36, OPAQUE(255, 255, 255));
    return scene;
}

/* ---------- Deterministic PDF sources ---------- */
async function newPdf(): Promise<PDFDocument> {
    const document = await PDFDocument.create();
    document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0));
    document.setProducer("iworkhere.space v0.4.3 example generator"); document.setCreator("iworkhere.space");
    return document;
}
export async function compressPdfSource(): Promise<Uint8Array> {
    const document = await newPdf(), regular = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold);
    const first = document.addPage([300, 400]);
    first.drawText("Weekly study log", { x: 24, y: 350, size: 22, font: bold });
    first.drawText("iworkhere.space example document - page 1 of 2", { x: 24, y: 328, size: 9, font: regular });
    ["Monday: reading, 40 minutes", "Tuesday: practice set, 55 minutes", "Wednesday: review notes, 30 minutes", "Thursday: group session, 60 minutes", "Friday: summary writing, 45 minutes"]
        .forEach((line, index) => first.drawText(line, { x: 24, y: 296 - index * 20, size: 11, font: regular }));
    [40, 55, 30, 60, 45].forEach((minutes, index) => first.drawRectangle({ x: 24 + index * 50, y: 60, width: 36, height: minutes * 1.4, color: rgb(0.17, 0.4, 0.65) }));
    const second = document.addPage([300, 400]); second.setRotation(degrees(90));
    second.drawText("Reading list", { x: 24, y: 350, size: 22, font: bold });
    second.drawText("iworkhere.space example document - page 2 of 2 (rotated 90 degrees)", { x: 24, y: 328, size: 9, font: regular });
    ["Chapter 1: measuring", "Chapter 2: sampling", "Chapter 3: comparing", "Chapter 4: reporting"].forEach((line, index) => {
        second.drawText(line, { x: 24, y: 296 - index * 24, size: 11, font: regular });
        second.drawLine({ start: { x: 24, y: 290 - index * 24 }, end: { x: 276, y: 290 - index * 24 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    });
    return document.save({ useObjectStreams: false, addDefaultPage: false });
}
export async function pdfToImageSource(): Promise<Uint8Array> {
    const document = await newPdf(), bold = await document.embedFont(StandardFonts.HelveticaBold), regular = await document.embedFont(StandardFonts.Helvetica);
    const first = document.addPage([300, 400]);
    first.drawRectangle({ x: 0, y: 0, width: 300, height: 400, color: rgb(0.81, 0.89, 1) });
    first.drawText("1", { x: 100, y: 120, size: 200, font: bold, color: rgb(0.1, 0.25, 0.6) });
    first.drawText("Page 1", { x: 20, y: 210, size: 10, font: regular });
    const second = document.addPage([300, 400]); second.setRotation(degrees(90));
    second.drawRectangle({ x: 0, y: 0, width: 300, height: 400, color: rgb(1, 0.9, 0.78) });
    second.drawEllipse({ x: 150, y: 150, xScale: 90, yScale: 90, color: rgb(0.85, 0.35, 0.05) });
    second.drawText("2", { x: 118, y: 100, size: 100, font: bold, color: rgb(1, 1, 1) });
    second.drawText("Page 2", { x: 20, y: 210, size: 10, font: regular });
    return document.save({ useObjectStreams: true, addDefaultPage: false });
}

/* ---------- Operations (the single recipe shared by generation and verification) ---------- */
const at = (tool: string, file: string) => `${EXAMPLE_ROOT}/${tool}/${file}`;
export const EXAMPLE_OPERATION: ExampleOperation[] = [
    { id: "compress-pdf-processed", exampleId: "compress-pdf-example", toolId: "compress-pdf", summary: "Compress the source PDF with the default tool behavior.", step: [
        { kind: "choose-files", control: "Choose PDF", asset: [at("compress-pdf", "source.pdf")] },
        { kind: "press-button", control: "Compress PDF", waitForHeading: "Smaller PDF ready" },
        { kind: "download", control: "Download compressed PDF", filename: "source-compressed.pdf", saveAs: at("compress-pdf", "processed.pdf") }] },
    { id: "pdf-to-image-png", exampleId: "pdf-to-image-example", toolId: "pdf-to-image", summary: "Convert page 1 to a PNG at 150 DPI.", step: [
        { kind: "choose-files", control: "Choose PDF", asset: [at("pdf-to-image", "source.pdf")] },
        { kind: "set-text", control: "Pages to convert", value: "1" },
        { kind: "choose-option", control: "Output format", value: "png" },
        { kind: "choose-option", control: "Resolution (DPI)", value: "150" },
        { kind: "press-button", control: "Convert pages", waitForHeading: "Page images ready" },
        { kind: "download", control: "Download page 1", filename: "source-page-001.png", saveAs: at("pdf-to-image", "page-001.png") }] },
    { id: "pdf-to-image-jpg", exampleId: "pdf-to-image-example", toolId: "pdf-to-image", summary: "Convert page 2 to a JPG at 150 DPI and the default JPEG quality.", step: [
        { kind: "choose-files", control: "Choose PDF", asset: [at("pdf-to-image", "source.pdf")] },
        { kind: "set-text", control: "Pages to convert", value: "2" },
        { kind: "choose-option", control: "Output format", value: "jpeg" },
        { kind: "choose-option", control: "Resolution (DPI)", value: "150" },
        { kind: "press-button", control: "Convert pages", waitForHeading: "Page images ready" },
        { kind: "download", control: "Download page 2", filename: "source-page-002.jpg", saveAs: at("pdf-to-image", "page-002.jpg") }] },
    { id: "images-to-pdf-result", exampleId: "images-to-pdf-example", toolId: "images-to-pdf", summary: "Combine the two images, in the listed order, into one PDF.", step: [
        { kind: "choose-files", control: "Choose JPEG or PNG images", asset: [at("images-to-pdf", "source-001.png"), at("images-to-pdf", "source-002.jpg")] },
        { kind: "press-button", control: "Create PDF", waitForHeading: "PDF ready" },
        { kind: "download", control: "Download PDF", filename: "images-to-pdf.pdf", saveAs: at("images-to-pdf", "result.pdf") }] },
    { id: "image-resizer-resized", exampleId: "image-resizer-example", toolId: "image-resizer", summary: "Resize to 400 px wide with the aspect ratio preserved.", step: [
        { kind: "choose-files", control: "Choose image", asset: [at("image-resizer", "source.png")] },
        { kind: "set-text", control: "Width", value: "400" },
        { kind: "press-button", control: "Resize image", waitForHeading: "Resized image ready" },
        { kind: "download", control: "Download resized image", filename: "source-400x300.png", saveAs: at("image-resizer", "resized.png") }] },
    { id: "image-converter-jpeg", exampleId: "image-converter-example", toolId: "image-converter", summary: "Convert the transparent PNG to JPEG at the default quality.", step: [
        { kind: "choose-files", control: "Choose image", asset: [at("image-converter", "source.png")] },
        { kind: "choose-option", control: "Output format", value: "jpeg" },
        { kind: "press-button", control: "Convert image", waitForHeading: "Converted image ready" },
        { kind: "download", control: "Download converted image", filename: "source-converted.jpg", saveAs: at("image-converter", "converted.jpg") }] },
    { id: "image-converter-webp", exampleId: "image-converter-example", toolId: "image-converter", summary: "Convert the transparent PNG to WebP at the default quality.", step: [
        { kind: "choose-files", control: "Choose image", asset: [at("image-converter", "source.png")] },
        { kind: "choose-option", control: "Output format", value: "webp" },
        { kind: "press-button", control: "Convert image", waitForHeading: "Converted image ready" },
        { kind: "download", control: "Download converted image", filename: "source-converted.webp", saveAs: at("image-converter", "converted.webp") }] },
];

/** Executes one recorded operation against the real tool page and returns the downloaded bytes. */
export async function runExampleOperation(page: Page, baseUrl: string, operation: ExampleOperation, repositoryRoot = process.cwd()): Promise<Uint8Array> {
    await page.goto(`${baseUrl}/tool/${operation.toolId}`);
    for (const step of operation.step) {
        if (step.kind === "choose-files") await page.getByLabel(step.control, { exact: true }).setInputFiles(step.asset.map(file => path.resolve(repositoryRoot, file)));
        else if (step.kind === "set-text") await page.getByLabel(step.control, { exact: true }).fill(step.value);
        else if (step.kind === "choose-option") await page.getByLabel(step.control, { exact: true }).selectOption(step.value);
        else if (step.kind === "press-button") {
            await page.getByRole("button", { name: step.control, exact: true }).click();
            await page.getByRole("heading", { name: step.waitForHeading, exact: true }).waitFor({ timeout: 60_000 });
        } else {
            const pending = page.waitForEvent("download");
            await page.getByRole("link", { name: step.control, exact: true }).click();
            const download = await pending;
            if (download.suggestedFilename() !== step.filename) throw new Error(`Unexpected download name ${download.suggestedFilename()} for ${operation.id}`);
            const target = await download.path();
            return new Uint8Array(await readFile(target));
        }
    }
    throw new Error(`Operation ${operation.id} has no download step`);
}

/* ---------- Generation ---------- */
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function exists(file: string) { return stat(file).then(() => true, () => false); }
async function writeNew(file: string, bytes: Uint8Array, overwrite: boolean) {
    if (!overwrite && await exists(file)) throw new Error(`${file} already exists; pass --overwrite to replace an immutable example asset deliberately.`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
}
async function jpegFromRaster(page: Page, raster: Raster): Promise<Uint8Array> {
    const encoded = await page.evaluate(async ({ data, width, height }) => {
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
        return Array.from(new Uint8Array(await blob!.arrayBuffer()));
    }, { data: Array.from(raster.data), width: raster.width, height: raster.height });
    return new Uint8Array(encoded);
}
async function decodeSize(page: Page, bytes: Uint8Array, mediaType: string) {
    return page.evaluate(async ({ data, type }) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type }));
        try { return { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); }
    }, { data: Array.from(bytes), type: mediaType });
}
const MEDIA_TYPE: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

async function main() {
    const argument = process.argv.slice(2), overwrite = argument.includes("--overwrite");
    const baseUrl = argument[argument.indexOf("--base-url") + 1];
    if (!baseUrl?.startsWith("http://127.0.0.1")) throw new Error("Pass --base-url for a local `npm run start` server.");
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage();
        await page.goto("about:blank");
        const source: [string, Uint8Array][] = [
            [at("compress-pdf", "source.pdf"), await compressPdfSource()], [at("pdf-to-image", "source.pdf"), await pdfToImageSource()],
            [at("images-to-pdf", "source-001.png"), encodePng(imagesToPdfFirstScene())], [at("images-to-pdf", "source-002.jpg"), await jpegFromRaster(page, imagesToPdfSecondScene())],
            [at("image-resizer", "source.png"), encodePng(resizerSourceScene())], [at("image-converter", "source.png"), encodePng(converterSourceScene())],
        ];
        for (const [file, bytes] of source) await writeNew(file, bytes, overwrite);
        const asset: ExampleAssetFact[] = [];
        const measure = async (file: string, bytes: Uint8Array, exampleId: string, role: "source" | "output", operation: string | null) => {
            const mediaType = MEDIA_TYPE[path.extname(file)];
            const fact: ExampleAssetFact = { path: file, exampleId, role, operation, mediaType, bytes: bytes.length, sha256: sha256(bytes) };
            if (mediaType === "application/pdf") {
                const inspected = await inspectCompressedArtifact(bytes);
                fact.pageCount = inspected.length; fact.page = inspected.map(value => ({ width: value.width, height: value.height, rotation: value.rotation }));
            } else Object.assign(fact, await decodeSize(page, bytes, mediaType));
            asset.push(fact);
        };
        const exampleOf = (file: string) => EXAMPLE_OPERATION.find(operation => operation.step.some(step => (step.kind === "choose-files" && step.asset.includes(file)) || (step.kind === "download" && step.saveAs === file)))!.exampleId;
        for (const [file, bytes] of source) await measure(file, bytes, exampleOf(file), "source", null);
        for (const operation of EXAMPLE_OPERATION) {
            const bytes = await runExampleOperation(page, baseUrl, operation);
            const download = operation.step.find(step => step.kind === "download")!;
            if (download.kind !== "download") throw new Error("Unreachable");
            await writeNew(download.saveAs, bytes, overwrite);
            await measure(download.saveAs, bytes, operation.exampleId, "output", operation.id);
        }
        asset.sort((left, right) => left.exampleId.localeCompare(right.exampleId) || left.path.localeCompare(right.path));
        const manifest: ExampleManifest = { schema: "iworkhere.space/value-examples/1", version: "0.4.3", operation: EXAMPLE_OPERATION, asset };
        await writeNew(`${EXAMPLE_ROOT}/manifest.json`, new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`), true);
        process.stdout.write(`Generated ${asset.length} assets under ${EXAMPLE_ROOT}\n`);
    } finally { await browser.close(); }
}
if (process.argv[1]?.endsWith("v043ExampleFixtures.ts")) void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Example generation failed"}\n`); process.exitCode = 1; });
