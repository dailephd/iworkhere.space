import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { inspectCompressedArtifact } from "../test/compressPdfVerification";
import { Raster } from "./v043ExampleFixtures";

/**
 * Repeatable generator for the v0.4.4 demonstration assets: Merge PDF, Split PDF, Image Compressor and HEIC Converter.
 *
 * Sources are authored here (PDFs with pdf-lib, the JPEG with a tiny rasterizer and the browser canvas), except the HEIC
 * source, which is an upstream MIT fixture copied only after its SHA-256 and Git blob id are verified.
 * Every output is produced by driving the real, built tool UI in Chromium and saving its actual download.
 * Nothing here merges, splits, compresses or converts a file in place of a tool. Run against `npm run start`:
 *   npx tsx script/v044ExampleFixtures.ts --base-url http://127.0.0.1:3100 [--output-root <dir>] [--overwrite]
 */

export const EXAMPLE_ROOT = "public/examples/v0.4.4";
export type ExampleStep =
    | { kind: "choose-files"; control: string; asset: string[] }
    | { kind: "set-text"; control: string; value: string }
    | { kind: "choose-option"; control: string; value: string }
    | { kind: "click-button"; control: string }
    | { kind: "press-button"; control: string; waitForHeading: string }
    | { kind: "download"; control: string; filename: string; saveAs: string };
export interface ExampleOperation { id: string; exampleId: string; toolId: string; summary: string; step: ExampleStep[] }
export type ExampleOrigin = "project-generated" | "tool-download" | "upstream-fixture";
export interface ExampleAssetFact {
    path: string; exampleId: string; role: "source" | "output"; operation: string | null; origin: ExampleOrigin; mediaType: string; bytes: number; sha256: string;
    width?: number; height?: number; pageCount?: number; page?: { width: number; height: number; rotation: number }[];
}
export interface ExampleUpstream { path: string; repository: string; commit: string; upstreamPath: string; gitBlob: string; license: string; licensePath: string }
export interface ExampleManifest {
    schema: "iworkhere.space/value-examples/1"; version: "0.4.4"; generator: string;
    upstream: ExampleUpstream[]; operation: ExampleOperation[]; asset: ExampleAssetFact[];
}
export interface ExampleDownload { saveAs: string; bytes: Uint8Array }

/* ---------- Upstream HEIC fixture (identity is checked before anything is copied) ---------- */
export const HEIC_FIXTURE = "test/fixtures/images/heic-source.heic";
export const HEIC_LICENSE_FIXTURE = "test/fixtures/images/licenses/heic-web-MIT.txt";
export const HEIC_UPSTREAM: ExampleUpstream = {
    path: `${EXAMPLE_ROOT}/heic-converter/source.heic`,
    repository: "https://github.com/su-engineering/heic-web",
    commit: "3261b10a31625dcb395b82081b3e9f7d10c9fc2c",
    upstreamPath: "test/fixtures/generated/asym-base.heic",
    gitBlob: "c6da5cea205f31fe2eab42c704583ee35f1dd27f",
    license: "MIT",
    licensePath: `${EXAMPLE_ROOT}/heic-converter/LICENSE.txt`,
};
export const HEIC_SHA256 = "b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119";
export const HEIC_BYTES = 3554;

/** Width and height from the HEIF `ispe` (image spatial extents) property, read without any decoder. */
export function heicDimension(bytes: Uint8Array): { width: number; height: number } {
    const at = Buffer.from(bytes).indexOf("ispe", 0, "latin1");
    if (at < 0) throw new Error("HEIC fixture has no ispe box");
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: view.getUint32(at + 8), height: view.getUint32(at + 12) };
}
/** LICENSE.txt: a plain statement of what the HEIC file is, followed by the pinned upstream license text unchanged. */
export function heicLicenseText(upstreamLicense: string): string {
    return `Upstream fixture notice
-----------------------
source.heic is NOT project-authored. It is the synthetic test fixture ${HEIC_UPSTREAM.upstreamPath}
from ${HEIC_UPSTREAM.repository}, pinned to commit ${HEIC_UPSTREAM.commit}.
Git blob ${HEIC_UPSTREAM.gitBlob}; ${HEIC_BYTES.toLocaleString("en-US")} bytes; SHA-256 ${HEIC_SHA256}.
It is used and redistributed under the MIT License reproduced below, unchanged, from that commit.
converted.jpg and converted.png are outputs of the HEIC converter tool run on that fixture; the project adds no claim over the fixture itself.

${upstreamLicense}`;
}
export function verifyHeicFixture(bytes: Uint8Array) {
    const blob = createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
    if (bytes.length !== HEIC_BYTES || sha256(bytes) !== HEIC_SHA256 || blob !== HEIC_UPSTREAM.gitBlob) throw new Error("The HEIC fixture does not match its recorded upstream identity.");
}

/* ---------- Deterministic PDF sources ---------- */
type Tint = [number, number, number];
async function newPdf(): Promise<PDFDocument> {
    const document = await PDFDocument.create();
    document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0));
    document.setProducer("iworkhere.space v0.4.4 example generator"); document.setCreator("iworkhere.space");
    return document;
}
/** One page per label: a tinted page, a very large label and a small caption that PDF.js can read back as text. */
async function labelledPdf(page: { label: string; caption: string; tint: Tint; size: [number, number] }[]): Promise<Uint8Array> {
    const document = await newPdf(), bold = await document.embedFont(StandardFonts.HelveticaBold), regular = await document.embedFont(StandardFonts.Helvetica);
    for (const value of page) {
        const [width, height] = value.size, sheet = document.addPage([width, height]);
        sheet.drawRectangle({ x: 0, y: 0, width, height, color: rgb(...value.tint) });
        sheet.drawText(value.label, { x: 24, y: height / 2 - 40, size: 110, font: bold, color: rgb(0.1, 0.12, 0.25) });
        sheet.drawText(value.caption, { x: 24, y: 24, size: 10, font: regular, color: rgb(0.1, 0.12, 0.25) });
    }
    return document.save({ useObjectStreams: false, addDefaultPage: false });
}
export function mergeFirstSource() {
    return labelledPdf([
        { label: "A1", caption: "Merge source 1 - page 1 of 2", tint: [0.81, 0.89, 1], size: [300, 400] },
        { label: "A2", caption: "Merge source 1 - page 2 of 2", tint: [0.7, 0.82, 0.98], size: [300, 400] },
    ]);
}
export function mergeSecondSource() {
    return labelledPdf([
        { label: "B1", caption: "Merge source 2 - page 1 of 3", tint: [1, 0.9, 0.78], size: [420, 300] },
        { label: "B2", caption: "Merge source 2 - page 2 of 3", tint: [1, 0.84, 0.66], size: [420, 300] },
        { label: "B3", caption: "Merge source 2 - page 3 of 3", tint: [0.98, 0.76, 0.55], size: [420, 300] },
    ]);
}
export function splitSource() {
    const tint: Tint[] = [[0.81, 0.89, 1], [1, 0.9, 0.78], [0.82, 0.95, 0.84], [0.9, 0.84, 0.97]];
    return labelledPdf(tint.map((value, index) => ({ label: `P${index + 1}`, caption: `Split source - page ${index + 1} of 4`, tint: value, size: [300, 400] as [number, number] })));
}

/* ---------- Deterministic raster source for the Image Compressor ---------- */
type Color = [number, number, number, number];
const OPAQUE = (r: number, g: number, b: number): Color => [r, g, b, 255];
/** A small linear congruential generator: the same grain on every run, no Math.random. */
function grain(seed: number) { let state = seed; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0xffffffff; }; }
export function compressorSourceScene(): Raster {
    const scene = new Raster(960, 640, OPAQUE(120, 170, 230));
    for (let row = 0; row < 360; row++) scene.rect(0, row, 960, 1, OPAQUE(120 + Math.round(row * 0.35), 170 + Math.round(row * 0.18), 230 - Math.round(row * 0.15)));
    scene.circle(780, 120, 70, OPAQUE(255, 214, 90));
    scene.circle(220, 470, 260, OPAQUE(74, 140, 82)); scene.circle(700, 520, 300, OPAQUE(52, 112, 70));
    scene.rect(0, 540, 960, 100, OPAQUE(94, 70, 48));
    scene.rect(380, 300, 200, 150, OPAQUE(196, 74, 60)); scene.triangle([360, 300], [600, 300], [480, 210], OPAQUE(60, 52, 70));
    scene.rect(450, 370, 60, 80, OPAQUE(250, 240, 220)); scene.rect(400, 330, 40, 40, OPAQUE(160, 210, 240)); scene.rect(520, 330, 40, 40, OPAQUE(160, 210, 240));
    const next = grain(44);
    for (let y = 360; y < 640; y++) for (let x = 0; x < 960; x++) {
        const at = (y * 960 + x) * 4, shift = Math.round((next() - 0.5) * 44);
        for (let channel = 0; channel < 3; channel++) scene.data[at + channel] = Math.max(0, Math.min(255, scene.data[at + channel] + shift));
    }
    return scene;
}

/* ---------- Operations (the single recipe shared by generation and verification) ---------- */
const at = (tool: string, file: string) => `${EXAMPLE_ROOT}/${tool}/${file}`;
export const EXAMPLE_OPERATION: ExampleOperation[] = [
    { id: "merge-pdf-result", exampleId: "merge-pdf-example", toolId: "merge-pdf", summary: "Merge the two sample PDFs, source 1 first, into one PDF.", step: [
        { kind: "choose-files", control: "Choose PDFs", asset: [at("merge-pdf", "source-001.pdf"), at("merge-pdf", "source-002.pdf")] },
        { kind: "press-button", control: "Merge PDF", waitForHeading: "Merged PDF ready" },
        { kind: "download", control: "Download merged PDF", filename: "source-001-merged.pdf", saveAs: at("merge-pdf", "result.pdf") }] },
    { id: "split-pdf-result", exampleId: "split-pdf-example", toolId: "split-pdf", summary: "Split the four-page sample into two output groups: pages 3,1 and pages 2-3.", step: [
        { kind: "choose-files", control: "Choose PDF", asset: [at("split-pdf", "source.pdf")] },
        { kind: "set-text", control: "Pages for output group 1", value: "3,1" },
        { kind: "click-button", control: "Add output group" },
        { kind: "set-text", control: "Pages for output group 2", value: "2-3" },
        { kind: "press-button", control: "Split PDF", waitForHeading: "Split PDFs ready" },
        { kind: "download", control: "Download output group 1", filename: "source-split-01-pages-3_1.pdf", saveAs: at("split-pdf", "result-001.pdf") },
        { kind: "download", control: "Download output group 2", filename: "source-split-02-pages-2-3.pdf", saveAs: at("split-pdf", "result-002.pdf") }] },
    { id: "image-compressor-compressed", exampleId: "image-compressor-example", toolId: "image-compressor", summary: "Compress the JPEG at Quality 40.", step: [
        { kind: "choose-files", control: "Choose image", asset: [at("image-compressor", "source.jpg")] },
        { kind: "set-text", control: "Quality", value: "40" },
        { kind: "press-button", control: "Compress image", waitForHeading: "Compressed image ready" },
        { kind: "download", control: "Download compressed image", filename: "source-compressed.jpg", saveAs: at("image-compressor", "compressed.jpg") }] },
    { id: "heic-converter-jpeg", exampleId: "heic-converter-example", toolId: "heic-converter", summary: "Convert the HEIC image to JPEG at Quality 90.", step: [
        { kind: "choose-files", control: "Choose HEIC image", asset: [at("heic-converter", "source.heic")] },
        { kind: "choose-option", control: "Output format", value: "jpeg" },
        { kind: "set-text", control: "Quality", value: "90" },
        { kind: "press-button", control: "Convert image", waitForHeading: "Converted image ready" },
        { kind: "download", control: "Download converted image", filename: "source-converted.jpg", saveAs: at("heic-converter", "converted.jpg") }] },
    { id: "heic-converter-png", exampleId: "heic-converter-example", toolId: "heic-converter", summary: "Convert the HEIC image to PNG.", step: [
        { kind: "choose-files", control: "Choose HEIC image", asset: [at("heic-converter", "source.heic")] },
        { kind: "choose-option", control: "Output format", value: "png" },
        { kind: "press-button", control: "Convert image", waitForHeading: "Converted image ready" },
        { kind: "download", control: "Download converted image", filename: "source-converted.png", saveAs: at("heic-converter", "converted.png") }] },
];

/** Executes one recorded operation against the real tool page and returns every file the tool actually downloaded, in step order. */
export async function runExampleOperation(page: Page, baseUrl: string, operation: ExampleOperation, repositoryRoot = process.cwd()): Promise<ExampleDownload[]> {
    await page.goto(`${baseUrl}/tool/${operation.toolId}`);
    const saved: ExampleDownload[] = [];
    for (const step of operation.step) {
        if (step.kind === "choose-files") await page.getByLabel(step.control, { exact: true }).setInputFiles(step.asset.map(file => path.resolve(repositoryRoot, file)));
        else if (step.kind === "set-text") await page.getByLabel(step.control, { exact: true }).fill(step.value);
        else if (step.kind === "choose-option") await page.getByLabel(step.control, { exact: true }).selectOption(step.value);
        else if (step.kind === "click-button") await page.getByRole("button", { name: step.control, exact: true }).click();
        else if (step.kind === "press-button") {
            await page.getByRole("button", { name: step.control, exact: true }).click();
            await page.getByRole("heading", { name: step.waitForHeading, exact: true }).waitFor({ timeout: 60_000 });
        } else {
            const pending = page.waitForEvent("download");
            await page.getByRole("link", { name: step.control, exact: true }).click();
            const download = await pending;
            if (download.suggestedFilename() !== step.filename) throw new Error(`Unexpected download name ${download.suggestedFilename()} for ${operation.id}`);
            saved.push({ saveAs: step.saveAs, bytes: new Uint8Array(await readFile(await download.path())) });
        }
    }
    if (!saved.length) throw new Error(`Operation ${operation.id} has no download step`);
    return saved;
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
const MEDIA_TYPE: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".heic": "image/heic" };

async function main() {
    const argument = process.argv.slice(2), overwrite = argument.includes("--overwrite");
    const baseUrl = argument[argument.indexOf("--base-url") + 1];
    if (!baseUrl?.startsWith("http://127.0.0.1")) throw new Error("Pass --base-url for a local `npm run start` server.");
    const rootFlag = argument.indexOf("--output-root");
    const outputRoot = rootFlag >= 0 ? path.resolve(argument[rootFlag + 1]) : process.cwd();
    const target = (file: string) => path.resolve(outputRoot, file);

    const heic = new Uint8Array(await readFile(HEIC_FIXTURE)), heicLicense = new Uint8Array(await readFile(HEIC_LICENSE_FIXTURE));
    verifyHeicFixture(heic);
    if (!new TextDecoder().decode(heicLicense).startsWith("MIT License")) throw new Error("The pinned upstream license is not the MIT license text.");

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage();
        await page.goto("about:blank");
        const source: [string, Uint8Array, ExampleOrigin][] = [
            [at("merge-pdf", "source-001.pdf"), await mergeFirstSource(), "project-generated"], [at("merge-pdf", "source-002.pdf"), await mergeSecondSource(), "project-generated"],
            [at("split-pdf", "source.pdf"), await splitSource(), "project-generated"],
            [at("image-compressor", "source.jpg"), await jpegFromRaster(page, compressorSourceScene()), "project-generated"],
            [HEIC_UPSTREAM.path, heic, "upstream-fixture"],
        ];
        for (const [file, bytes] of source) await writeNew(target(file), bytes, overwrite);
        await writeNew(target(HEIC_UPSTREAM.licensePath), new TextEncoder().encode(heicLicenseText(new TextDecoder().decode(heicLicense).replace(/\r\n/g, "\n"))), overwrite);

        const asset: ExampleAssetFact[] = [];
        const measure = async (file: string, bytes: Uint8Array, exampleId: string, role: "source" | "output", operation: string | null, origin: ExampleOrigin) => {
            const mediaType = MEDIA_TYPE[path.extname(file)];
            const fact: ExampleAssetFact = { path: file, exampleId, role, operation, origin, mediaType, bytes: bytes.length, sha256: sha256(bytes) };
            if (mediaType === "application/pdf") {
                const inspected = await inspectCompressedArtifact(bytes);
                fact.pageCount = inspected.length; fact.page = inspected.map(value => ({ width: value.width, height: value.height, rotation: value.rotation }));
            } else if (mediaType === "image/heic") Object.assign(fact, heicDimension(bytes));
            else Object.assign(fact, await decodeSize(page, bytes, mediaType));
            asset.push(fact);
        };
        const exampleOf = (file: string) => EXAMPLE_OPERATION.find(operation => operation.step.some(step => (step.kind === "choose-files" && step.asset.includes(file)) || (step.kind === "download" && step.saveAs === file)))!.exampleId;
        for (const [file, bytes, origin] of source) await measure(file, bytes, exampleOf(file), "source", null, origin);
        for (const operation of EXAMPLE_OPERATION) {
            for (const download of await runExampleOperation(page, baseUrl, operation, outputRoot)) {
                await writeNew(target(download.saveAs), download.bytes, overwrite);
                await measure(download.saveAs, download.bytes, operation.exampleId, "output", operation.id, "tool-download");
            }
        }
        asset.sort((left, right) => left.exampleId.localeCompare(right.exampleId) || left.path.localeCompare(right.path));
        const manifest: ExampleManifest = { schema: "iworkhere.space/value-examples/1", version: "0.4.4", generator: "script/v044ExampleFixtures.ts", upstream: [HEIC_UPSTREAM], operation: EXAMPLE_OPERATION, asset };
        await writeNew(target(`${EXAMPLE_ROOT}/manifest.json`), new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`), overwrite);
        process.stdout.write(`Generated ${asset.length} assets under ${target(EXAMPLE_ROOT)}\n`);
    } finally { await browser.close(); }
}
if (process.argv[1]?.endsWith("v044ExampleFixtures.ts")) void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Example generation failed"}\n`); process.exitCode = 1; });
