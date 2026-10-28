import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import manifest from "../../../public/examples/v0.4.3/manifest.json";
import manifest044 from "../../../public/examples/v0.4.4/manifest.json";
import { inspectCompressedArtifact } from "../../../test/compressPdfVerification";
import { inspectImagePdf } from "../../../test/imagesToPdfVerification";
import { detectImageFileFormat } from "./image/imageFile";
import { heightFromWidth } from "./image/imageResizer";
import { imageCompressorFilename, imageCompressorSavings, validateImageCompressorQuality } from "./image/imageCompressor";
import { heicFilename, heicQuality } from "./image/heicConverter";
import { mergePdfFilename } from "./document/mergePdf";
import { splitPdfFilename } from "./document/splitPdf";
import { parsePageSelection } from "./document/pageSelection";
import { tool_definition_list } from "./registry";
import { getAllValueExample, getFeaturedValueExample, getValueExample } from "./valueExamples";

const ROOT = "public/examples/v0.4.3";
const ROOT4 = "public/examples/v0.4.4";
const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
const EXAMPLE_ID = FEATURED.map(id => `${id}-example`);
const NEW_TOOL = ["merge-pdf", "split-pdf", "image-compressor", "heic-converter"];
const NEW_EXAMPLE_ID = NEW_TOOL.map(id => `${id}-example`);
const AUTHORIZED_V044 = [
    "merge-pdf/source-001.pdf", "merge-pdf/source-002.pdf", "merge-pdf/result.pdf", "split-pdf/source.pdf", "split-pdf/result-001.pdf", "split-pdf/result-002.pdf",
    "image-compressor/source.jpg", "image-compressor/compressed.jpg", "heic-converter/source.heic", "heic-converter/converted.jpg", "heic-converter/converted.png",
].map(file => `${ROOT4}/${file}`);
const PREVIEWABLE = ["image/png", "image/jpeg", "image/webp"];
const AUTHORIZED = [
    "compress-pdf/source.pdf", "compress-pdf/processed.pdf", "pdf-to-image/source.pdf", "pdf-to-image/page-001.png", "pdf-to-image/page-002.jpg",
    "images-to-pdf/source-001.png", "images-to-pdf/source-002.jpg", "images-to-pdf/result.pdf", "image-resizer/source.png", "image-resizer/resized.png",
    "image-converter/source.png", "image-converter/converted.jpg", "image-converter/converted.webp",
].map(file => `${ROOT}/${file}`);
const MEDIA_TYPE_OF: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

interface Fact { path: string; mediaType: string; bytes: number; sha256: string; width?: number; height?: number; pageCount?: number }
const fact = (file: string) => manifest.asset.find(value => value.path === `${ROOT}/${file}`) as Fact & { page?: { width: number; height: number; rotation: number }[] };
const read = async (file: string) => new Uint8Array(await readFile(`${ROOT}/${file}`));

/* ---------- Independent binary readers: they read the committed bytes, never the manifest ---------- */
function signature(bytes: Uint8Array): string | null {
    if (new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-" && new TextDecoder().decode(bytes.subarray(-8)).includes("%%EOF")) return "pdf";
    return detectImageFileFormat(bytes);
}
function pngSize(bytes: Uint8Array) { const view = new DataView(bytes.buffer, bytes.byteOffset); return { width: view.getUint32(16), height: view.getUint32(20) }; }
function jpegSize(bytes: Uint8Array) {
    for (let offset = 2; offset + 9 < bytes.length;) {
        if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker");
        const marker = bytes[offset + 1], length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (marker >= 0xc0 && marker <= 0xc2) return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
        offset += 2 + length;
    }
    throw new Error("JPEG has no frame header");
}
function webpInfo(bytes: Uint8Array) {
    const type = new TextDecoder().decode(bytes.subarray(12, 16));
    if (type === "VP8X") {
        const flag = bytes[20], size = (at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + 1;
        return { width: size(24), height: size(27), alphaFlag: (flag & 0x10) !== 0, alphaChunk: new TextDecoder("latin1").decode(bytes).includes("ALPH") };
    }
    if (type === "VP8 ") return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff, alphaFlag: false, alphaChunk: false };
    throw new Error(`Unexpected WebP chunk ${type}`);
}
interface DecodedPng { width: number; height: number; pixel(x: number, y: number): number[] }
function decodePng(bytes: Uint8Array): DecodedPng {
    const view = new DataView(bytes.buffer, bytes.byteOffset), width = view.getUint32(16), height = view.getUint32(20);
    const depth = bytes[24], colorType = bytes[25], interlace = bytes[28];
    if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) throw new Error(`Unsupported PNG layout ${depth}/${colorType}/${interlace}`);
    const idat: Uint8Array[] = [];
    for (let offset = 8; offset < bytes.length;) {
        const length = view.getUint32(offset), type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
        if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat)), channel = colorType === 6 ? 4 : 3, row = width * channel, out = new Uint8Array(row * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (row + 1)];
        for (let x = 0; x < row; x++) {
            const value = raw[y * (row + 1) + 1 + x], left = x >= channel ? out[y * row + x - channel] : 0, up = y > 0 ? out[(y - 1) * row + x] : 0;
            const upLeft = x >= channel && y > 0 ? out[(y - 1) * row + x - channel] : 0;
            const paeth = () => { const p = left + up - upLeft, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upLeft); return a <= b && a <= c ? left : b <= c ? up : upLeft; };
            out[y * row + x] = (value + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth())) & 255;
        }
    }
    return { width, height, pixel: (x, y) => { const at = y * row + x * channel; return [out[at], out[at + 1], out[at + 2], channel === 4 ? out[at + 3] : 255]; } };
}
const near = (actual: number[], expected: number[], tolerance = 3) => expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);

/** Identity problems for one asset; used on real files and on a tampered copy to prove replacement is detected. */
function identityProblem(file: Fact, bytes: Uint8Array): string[] {
    const problem: string[] = [];
    if (bytes.length !== file.bytes) problem.push("byte count");
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) problem.push("sha256");
    const kind = signature(bytes);
    if (!kind || MEDIA_TYPE_OF[kind] !== file.mediaType) problem.push("signature/media type");
    return problem;
}

describe("value example records", () => {
    it("define nine examples with stable unique IDs: the five v0.4.3 tools first, then the four v0.4.4 tools", () => {
        const example = getAllValueExample();
        expect(example.map(value => value.id)).toEqual([...EXAMPLE_ID, ...NEW_EXAMPLE_ID]);
        expect(example.map(value => value.toolId)).toEqual([...FEATURED, ...NEW_TOOL]);
        expect(new Set(example.map(value => value.id)).size).toBe(9);
        expect(manifest.asset.map(value => value.exampleId).filter((value, index, list) => list.indexOf(value) === index).sort()).toEqual([...EXAMPLE_ID].sort());
        expect(manifest044.asset.map(value => value.exampleId).filter((value, index, list) => list.indexOf(value) === index).sort()).toEqual([...NEW_EXAMPLE_ID].sort());
    });
    it("feature exactly the five original tasks on the home page and none of the four new examples", () => {
        expect(getFeaturedValueExample().map(value => value.toolId)).toEqual(FEATURED);
        expect(getAllValueExample().filter(value => value.featuredOnHome).map(value => value.toolId)).toEqual(FEATURED);
        for (const id of NEW_TOOL) expect(getValueExample(id)!.featuredOnHome, id).toBe(false);
        expect(getAllValueExample()).toHaveLength(9);
        // The projection hands out copies of the list: changing one cannot change what the home page shows.
        getFeaturedValueExample().pop();
        expect(getFeaturedValueExample()).toHaveLength(5);
    });
    it("resolve every example tool through the existing registry and return nothing for any other tool", () => {
        const registered = tool_definition_list.map(tool => tool.id);
        const withExample = [...FEATURED, ...NEW_TOOL];
        for (const id of withExample) { expect(registered).toContain(id); expect(getValueExample(id)?.toolId).toBe(id); }
        for (const id of registered.filter(value => !withExample.includes(value))) expect(getValueExample(id), id).toBeUndefined();
        expect(getValueExample("not-a-tool")).toBeUndefined();
    });
    it("carry every required descriptive field and no external reference", () => {
        for (const value of getAllValueExample()) {
            for (const text of [value.task, value.whyThisTool, value.outcome, value.provenance.generator, value.provenance.permission]) expect(text.length, value.id).toBeGreaterThan(20);
            for (const list of [value.operation, value.source, value.output, value.sourceFormat, value.outputFormat, value.changed, value.unchanged, value.limitation]) expect(list.length, value.id).toBeGreaterThan(0);
            for (const operation of value.operation) expect(operation.reproduction.length, operation.id).toBeGreaterThanOrEqual(3);
            for (const file of [...value.source, ...value.output]) expect(file.url).toBe(file.path.replace(/^public/, ""));
            expect(JSON.stringify(value), value.id).not.toMatch(/https?:\/\//);
        }
    });
});

describe("committed example assets", () => {
    it("are exactly the authorized public paths, in deterministic manifest order, with nothing stray", async () => {
        expect(manifest.asset.map(value => value.path).sort()).toEqual([...AUTHORIZED].sort());
        const order = manifest.asset.map(value => `${value.exampleId}|${value.path}`);
        expect(order).toEqual([...order].sort((left, right) => left.localeCompare(right)));
        const onDisk: string[] = [];
        for (const entry of await readdir(ROOT, { recursive: true, withFileTypes: true })) if (entry.isFile()) onDisk.push(path.posix.join(ROOT, path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/")));
        expect(onDisk.sort()).toEqual([...AUTHORIZED, `${ROOT}/README.md`, `${ROOT}/manifest.json`].sort());
        expect(new Set(manifest.asset.map(value => value.sha256)).size).toBe(manifest.asset.length);
    });
    it("match the manifest byte count, SHA-256, signature and media type, and a replaced file is detected", async () => {
        for (const entry of manifest.asset) {
            const bytes = new Uint8Array(await readFile(entry.path));
            expect(identityProblem(entry, bytes), entry.path).toEqual([]);
        }
        const original = await read("image-resizer/source.png"), replaced = original.slice();
        replaced[replaced.length - 20] ^= 0xff;
        expect(identityProblem(fact("image-resizer/source.png"), replaced)).toContain("sha256");
        expect(identityProblem(fact("image-resizer/source.png"), original.subarray(0, 100))).toContain("byte count");
        expect(identityProblem(fact("image-resizer/source.png"), await read("image-converter/converted.jpg"))).toContain("signature/media type");
    });
    it("have image dimensions that agree with the headers inside the files", async () => {
        for (const entry of manifest.asset.filter(value => value.mediaType.startsWith("image/"))) {
            const bytes = new Uint8Array(await readFile(entry.path));
            const size = entry.mediaType === "image/png" ? pngSize(bytes) : entry.mediaType === "image/jpeg" ? jpegSize(bytes) : webpInfo(bytes);
            expect({ width: size.width, height: size.height }, entry.path).toEqual({ width: entry.width, height: entry.height });
        }
    });
    it("keep the provenance README aligned with the committed files", async () => {
        const readme = await readFile(`${ROOT}/README.md`, "utf8");
        for (const file of AUTHORIZED) expect(readme, file).toContain(file.slice(ROOT.length + 1));
        expect(readme).toMatch(/original/i);
    });
});

describe("Compress PDF example", () => {
    it("records a truthful verified-smaller result whose content is preserved page for page", async () => {
        const source = await read("compress-pdf/source.pdf"), processed = await read("compress-pdf/processed.pdf");
        expect(processed.length).toBeLessThan(source.length);
        const before = await inspectCompressedArtifact(source), after = await inspectCompressedArtifact(processed);
        expect(before).toHaveLength(2);
        expect(after).toEqual(before);
        expect(before.map(page => [page.width, page.height, page.rotation])).toEqual([[300, 400, 0], [300, 400, 90]]);
        expect(before[0].text).toContain("Weekly study log");
        expect(before[1].text).toContain("Reading list");
        expect(getValueExample("compress-pdf")!.outcome).toContain(`${(source.length - processed.length).toLocaleString("en-US")} bytes`);
    });
    it("reproduces processed.pdf byte for byte with the pinned QPDF and the production arguments", async () => {
        const directory = path.resolve(".my-dev-kit-workflow", `value-example-qpdf-${process.pid}-${Date.now()}`);
        await mkdir(directory, { recursive: true });
        try {
            const glue = path.join(directory, "qpdf.mjs");
            await copyFile("public/vendor/qpdf/12.4.2/qpdf.js", glue);
            const factory = await import(/* @vite-ignore */ pathToFileURL(glue).href) as { default(option: object): Promise<{ FS: { writeFile(name: string, bytes: Uint8Array): void; readFile(name: string): Uint8Array }; callMain(argument: string[]): number }> };
            const runtime = await factory.default({ locateFile: () => path.resolve("public/vendor/qpdf/12.4.2/qpdf.wasm"), print() {}, printErr() {} });
            runtime.FS.writeFile("/input.pdf", await read("compress-pdf/source.pdf"));
            expect(runtime.callMain(["--object-streams=generate", "--recompress-flate", "--compression-level=9", "--deterministic-id", "/input.pdf", "/output.pdf"])).toBe(0);
            expect(Buffer.from(runtime.FS.readFile("/output.pdf")).equals(Buffer.from(await read("compress-pdf/processed.pdf")))).toBe(true);
        } finally { await rm(directory, { recursive: true, force: true }); }
    });
});

describe("PDF to Image example", () => {
    it("has two distinguishable pages and output images sized from the real page geometry at 150 DPI", async () => {
        const evidence = await inspectCompressedArtifact(await read("pdf-to-image/source.pdf"));
        expect(evidence.map(page => [page.width, page.height, page.rotation])).toEqual([[300, 400, 0], [300, 400, 90]]);
        expect(evidence[0].text).toContain("Page 1");
        expect(evidence[1].text).toContain("Page 2");
        expect(evidence[0].raster).not.toBe(evidence[1].raster);
        const expected = evidence.map(page => {
            const [width, height] = page.rotation % 180 === 0 ? [page.width, page.height] : [page.height, page.width];
            return { width: Math.ceil(width * 150 / 72), height: Math.ceil(height * 150 / 72) };
        });
        expect(pngSize(await read("pdf-to-image/page-001.png"))).toEqual(expected[0]);
        expect(jpegSize(await read("pdf-to-image/page-002.jpg"))).toEqual(expected[1]);
        expect(expected[1]).toEqual({ width: expected[0].height, height: expected[0].width });
    });
    it("keeps the page 1 PNG background tint at its top-left corner (JPEG pixels are verified in the browser spec)", async () => {
        const page = decodePng(await read("pdf-to-image/page-001.png"));
        expect(near(page.pixel(35, 25), [207, 227, 255, 255], 2)).toBe(true);
    });
});

describe("Images to PDF example", () => {
    it("places one source image per page in source order with point sizes equal to pixel sizes", async () => {
        const first = await read("images-to-pdf/source-001.png"), second = await read("images-to-pdf/source-002.jpg"), result = await read("images-to-pdf/result.pdf");
        expect(pngSize(first)).toEqual({ width: 400, height: 300 });
        expect(jpegSize(second)).toEqual({ width: 320, height: 400 });
        const page = await inspectImagePdf(result);
        expect(page.map(value => [value.width, value.height, value.rotation])).toEqual([[400, 300, 0], [320, 400, 0]]);
        // Page 1 is the PNG with a transparent margin: the colored viewer background shows through. Page 2 is the opaque teal JPEG.
        for (const sample of page[0].pixel) expect(near(sample, [0x12, 0xab, 0x34, 255], 1)).toBe(true);
        for (const sample of page[1].pixel) expect(near(sample, [15, 118, 110, 255], 12)).toBe(true);
    });
    it("embeds the JPEG stream unchanged and the PNG with a soft mask for its transparency", async () => {
        const result = Buffer.from(await read("images-to-pdf/result.pdf")), jpeg = Buffer.from(await read("images-to-pdf/source-002.jpg"));
        expect(result.indexOf(jpeg)).toBeGreaterThan(0);
        expect(result.toString("latin1")).toContain("/SMask");
        const png = decodePng(await read("images-to-pdf/source-001.png"));
        expect(png.pixel(5, 5)[3]).toBe(0);
        expect(png.pixel(60, 60)).toEqual([249, 115, 22, 255]);
    });
});

describe("Image Resizer example", () => {
    it("halves 800 × 600 to 400 × 300 with the tool's own height derivation and the same content", async () => {
        const source = decodePng(await read("image-resizer/source.png")), output = decodePng(await read("image-resizer/resized.png"));
        expect([source.width, source.height, output.width, output.height]).toEqual([800, 600, 400, 300]);
        expect(heightFromWidth(output.width, source)).toBe(output.height);
        expect(output.width / output.height).toBeCloseTo(source.width / source.height, 10);
        for (const [x, y, color] of [[64, 64, [214, 40, 40]], [736, 64, [42, 157, 143]], [64, 536, [29, 78, 216]], [736, 536, [244, 180, 0]]] as const) {
            expect(near(source.pixel(x, y), [...color, 255], 0)).toBe(true);
            expect(near(output.pixel(x / 2, y / 2), [...color, 255], 12), `corner ${x},${y}`).toBe(true);
        }
        expect(near(output.pixel(200, 70), [109, 40, 217, 255], 12)).toBe(true);
    });
});

describe("Image Converter example", () => {
    it("starts from a transparent PNG with a transparent hole inside an opaque shape", async () => {
        const source = decodePng(await read("image-converter/source.png"));
        expect([source.width, source.height]).toEqual([480, 320]);
        expect(source.pixel(2, 2)[3]).toBe(0);
        expect(source.pixel(140, 160)[3]).toBe(0);
        expect(source.pixel(140, 230)).toEqual([230, 57, 70, 255]);
        expect(source.pixel(350, 100)).toEqual([29, 78, 216, 255]);
    });
    it("produces a same-size JPEG and a WebP that carries an alpha channel", async () => {
        expect(jpegSize(await read("image-converter/converted.jpg"))).toEqual({ width: 480, height: 320 });
        const webp = webpInfo(await read("image-converter/converted.webp"));
        expect(webp).toMatchObject({ width: 480, height: 320, alphaFlag: true, alphaChunk: true });
    });
});

describe("verified asset descriptions", () => {
    const assets = () => getAllValueExample().flatMap(value => [...value.source, ...value.output]);
    const description = (file: string) => assets().find(asset => asset.path === `${ROOT}/${file}`)!.description;

    it("exist for every authorized asset, leave the measured manifest facts untouched and carry no manifest drift", () => {
        expect(assets().map(asset => asset.path).sort()).toEqual([...AUTHORIZED, ...AUTHORIZED_V044].sort());
        for (const asset of assets()) {
            const recorded = [...manifest.asset, ...manifest044.asset].find(value => value.path === asset.path)!;
            expect(asset.description.trim().length, asset.path).toBeGreaterThan(20);
            expect({ bytes: asset.bytes, sha256: asset.sha256, mediaType: asset.mediaType }, asset.path).toEqual({ bytes: recorded.bytes, sha256: recorded.sha256, mediaType: recorded.mediaType });
            expect(Object.keys(recorded), "descriptions must not be written into the manifest").not.toContain("description");
        }
    });
    it("describe each image in a sentence that does not merely restate its filename, format or size", () => {
        // HEIC has no inline preview, so like a PDF its description is a noun phrase used in the download link name.
        for (const asset of assets().filter(value => PREVIEWABLE.includes(value.mediaType))) {
            expect(asset.description, asset.path).toMatch(/\.$/);
            expect(asset.description.toLowerCase(), asset.path).not.toContain(path.posix.basename(asset.path).toLowerCase());
            expect(asset.description, asset.path).not.toMatch(/\b\d[\d,]* bytes\b/);
        }
    });
    it("claim transparency only where the committed bytes have it", async () => {
        const source = decodePng(await read("image-converter/source.png"));
        expect([source.pixel(2, 2)[3], source.pixel(140, 160)[3]]).toEqual([0, 0]);
        expect(description("image-converter/source.png")).toContain("transparent background");
        const first = decodePng(await read("images-to-pdf/source-001.png"));
        expect(first.pixel(5, 5)[3]).toBe(0);
        expect(first.pixel(235, 150)).toEqual([255, 255, 255, 255]);
        expect(first.pixel(100, 150)).toEqual([249, 115, 22, 255]);
        expect(description("images-to-pdf/source-001.png")).toContain("transparent margin");
        expect(description("images-to-pdf/source-001.png")).toContain("white vertical bar");
        expect(webpInfo(await read("image-converter/converted.webp"))).toMatchObject({ alphaFlag: true, alphaChunk: true });
        expect(description("image-converter/converted.webp")).toContain("transparent background");
        expect(signature(await read("image-converter/converted.jpg"))).toBe("jpeg");
        expect(description("image-converter/converted.jpg")).toContain("solid white background");
        expect(description("image-converter/converted.jpg")).toContain("JPEG cannot store transparency");
    });
    it("match the colors and scale of the committed resizer and PDF page images", async () => {
        const source = decodePng(await read("image-resizer/source.png")), output = decodePng(await read("image-resizer/resized.png"));
        expect(near(source.pixel(150, 50), [244, 241, 234, 255], 0)).toBe(true);
        expect(near(source.pixel(2, 2), [34, 34, 51, 255], 0)).toBe(true);
        expect(near(source.pixel(64, 64), [214, 40, 40, 255], 0)).toBe(true);
        expect(near(source.pixel(400, 150), [109, 40, 217, 255], 0)).toBe(true);
        expect(near(source.pixel(400, 300), [244, 241, 234, 255], 0)).toBe(true);
        expect([output.width * 2, output.height * 2]).toEqual([source.width, source.height]);
        expect(description("image-resizer/source.png")).toMatch(/cream background.*purple ring/);
        expect(description("image-resizer/resized.png")).toContain("half the width and height");
        const page = decodePng(await read("pdf-to-image/page-001.png"));
        expect(near(page.pixel(35, 25), [207, 227, 255, 255], 2)).toBe(true);
        expect(description("pdf-to-image/page-001.png")).toContain("pale blue page");
        const landscape = jpegSize(await read("pdf-to-image/page-002.jpg"));
        expect(landscape.width).toBeGreaterThan(landscape.height);
        expect(description("pdf-to-image/page-002.jpg")).toContain("landscape");
        expect((await inspectCompressedArtifact(await read("pdf-to-image/source.pdf")))[1].rotation).toBe(90);
    });
});

describe("reproduction instructions", () => {
    const toolSource: Record<string, string> = {
        "compress-pdf": "document/CompressPdfTool.tsx", "pdf-to-image": "document/PdfToImageTool.tsx", "images-to-pdf": "document/ImagesToPdfTool.tsx",
        "image-resizer": "image/ImageResizerTool.tsx", "image-converter": "image/ImageConverterTool.tsx",
    };
    it("use only control labels, headings and option values that exist in the real tool source", async () => {
        for (const operation of manifest.operation) {
            // The two image tools share the file chooser owned by ImageSourcePanel.
            const shared = operation.toolId.startsWith("image-") ? await readFile("src/component/tool/image/ImageSourcePanel.tsx", "utf8") : "";
            const source = `${await readFile(path.join("src/module/tool", toolSource[operation.toolId]), "utf8")}
${shared}`;
            expect(FEATURED).toContain(operation.toolId);
            for (const step of operation.step as { kind: string; control: string; value?: string; waitForHeading?: string }[]) {
                const control = step.kind === "download" && operation.toolId === "pdf-to-image" ? step.control.replace(/ \d+$/, "") : step.control;
                expect(source.includes(control), `${operation.id}: ${step.control}`).toBe(true);
                if (step.waitForHeading) expect(source.includes(step.waitForHeading), `${operation.id}: ${step.waitForHeading}`).toBe(true);
                if (step.kind === "choose-option" && operation.toolId === "pdf-to-image" && step.control === "Output format") expect(source.includes(`<option value="${step.value}">`), `${operation.id}: option`).toBe(true);
            }
        }
    });
    it("only demonstrate settings the tools allow", () => {
        const dpi = manifest.operation.flatMap(operation => operation.step).filter(step => step.control === "Resolution (DPI)");
        for (const step of dpi) expect(["72", "150", "300"]).toContain((step as { value: string }).value);
        const pages = manifest.operation.flatMap(operation => operation.step).filter(step => step.control === "Pages to convert");
        for (const step of pages) expect((step as { value: string }).value.split(",").length).toBeLessThanOrEqual(20);
    });
});

/* ====================== v0.4.4 examples: Merge PDF, Split PDF, Image Compressor, HEIC ====================== */
interface Fact4 extends Fact { exampleId: string; role: string; operation: string | null; origin: string; page?: { width: number; height: number; rotation: number }[] }
interface Step4 { kind: string; control: string; asset?: string[]; value?: string; filename?: string; saveAs?: string; waitForHeading?: string }
const fact4 = (file: string) => manifest044.asset.find(value => value.path === `${ROOT4}/${file}`) as unknown as Fact4;
const read4 = async (file: string) => new Uint8Array(await readFile(`${ROOT4}/${file}`));
const lines = async (file: string) => (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
const step4 = (operationId: string) => manifest044.operation.find(value => value.id === operationId)!.step as Step4[];
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const MEDIA_TYPE_OF_4: Record<string, string> = { ...MEDIA_TYPE_OF, heic: "image/heic" };

/** HEIF is an ISO base media file: an `ftyp` box first, then boxes that nest. This walks to the first `ispe` property, independent of the generator's search. */
function isHeif(bytes: Uint8Array) {
    return new TextDecoder("latin1").decode(bytes.subarray(4, 8)) === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(new TextDecoder("latin1").decode(bytes.subarray(8, 12)));
}
function heifSize(bytes: Uint8Array) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const find = (start: number, end: number, route: string[]): { start: number; end: number } | null => {
        for (let offset = start; offset + 8 <= end;) {
            const size = view.getUint32(offset), type = new TextDecoder("latin1").decode(bytes.subarray(offset + 4, offset + 8));
            if (size < 8) return null;
            const boxEnd = Math.min(end, offset + size), body = offset + 8 + (type === "meta" ? 4 : 0);
            if (type === route[0]) return route.length === 1 ? { start: body, end: boxEnd } : find(body, boxEnd, route.slice(1));
            offset += size;
        }
        return null;
    };
    const box = find(0, bytes.length, ["meta", "iprp", "ipco", "ispe"]);
    if (!box) throw new Error("HEIF has no ispe property");
    return { width: view.getUint32(box.start + 4), height: view.getUint32(box.start + 8) };
}
function signature4(bytes: Uint8Array): string | null { return isHeif(bytes) ? "heic" : signature(bytes); }
const jpegComplete = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
function identityProblem4(file: Fact, bytes: Uint8Array): string[] {
    const problem: string[] = [];
    if (bytes.length !== file.bytes) problem.push("byte count");
    if (sha256(bytes) !== file.sha256) problem.push("sha256");
    const kind = signature4(bytes);
    if (!kind || MEDIA_TYPE_OF_4[kind] !== file.mediaType) problem.push("signature/media type");
    if (file.mediaType === "image/jpeg" && !jpegComplete(bytes)) problem.push("truncated JPEG");
    return problem;
}

/** PDF.js evidence per page: size, rotation, extracted text and a hash of the rendered pixels. */
const evidence = new Map<string, ReturnType<typeof inspectCompressedArtifact>>();
const pagesOf = (file: string) => { if (!evidence.has(file)) evidence.set(file, read4(file).then(bytes => inspectCompressedArtifact(bytes))); return evidence.get(file)!; };
const labelOf = (page: { text: string }) => (JSON.parse(page.text) as string[][])[0][0];
type PageEvidence = Awaited<ReturnType<typeof inspectCompressedArtifact>>[number];
const samePage = (left: PageEvidence, right: PageEvidence) => left.raster === right.raster && left.text === right.text && left.width === right.width && left.height === right.height && left.rotation === right.rotation;

describe("v0.4.4 example records carry what a visitor needs", () => {
    it("carry every required descriptive field, a reproducible operation and no external reference", () => {
        for (const id of NEW_TOOL) {
            const value = getValueExample(id)!;
            for (const text of [value.task, value.whyThisTool, value.outcome, value.provenance.generator, value.provenance.permission]) expect(text.length, value.id).toBeGreaterThan(20);
            for (const list of [value.operation, value.source, value.output, value.sourceFormat, value.outputFormat, value.changed, value.unchanged, value.limitation]) expect(list.length, value.id).toBeGreaterThan(0);
            for (const operation of value.operation) expect(operation.reproduction.length, operation.id).toBeGreaterThanOrEqual(3);
            for (const file of [...value.source, ...value.output]) expect(file.url).toBe(file.path.replace(/^public/, ""));
            expect(value.provenance.readme).toBe(`${ROOT4}/README.md`);
            expect(JSON.stringify(value), value.id).not.toMatch(/https?:\/\//);
        }
    });
    it("list every downloaded file of an operation, in order, and keep the original five untouched", () => {
        expect(getValueExample("split-pdf")!.operation[0].outputPath).toEqual([`${ROOT4}/split-pdf/result-001.pdf`, `${ROOT4}/split-pdf/result-002.pdf`]);
        expect(getValueExample("heic-converter")!.operation.map(operation => operation.outputPath)).toEqual([[`${ROOT4}/heic-converter/converted.jpg`], [`${ROOT4}/heic-converter/converted.png`]]);
        expect(getValueExample("compress-pdf")!.operation[0].outputPath).toEqual([`${ROOT}/compress-pdf/processed.pdf`]);
        for (const id of FEATURED) expect(getValueExample(id)!.featuredOnHome, id).toBe(true);
    });
});

describe("committed v0.4.4 example assets", () => {
    it("are exactly the authorized public paths, in deterministic manifest order, with nothing stray", async () => {
        expect(manifest044.asset.map(value => value.path).sort()).toEqual([...AUTHORIZED_V044].sort());
        const order = manifest044.asset.map(value => `${value.exampleId}|${value.path}`);
        expect(order).toEqual([...order].sort((left, right) => left.localeCompare(right)));
        const onDisk: string[] = [];
        for (const entry of await readdir(ROOT4, { recursive: true, withFileTypes: true })) if (entry.isFile()) onDisk.push(path.posix.join(ROOT4, path.relative(ROOT4, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/")));
        expect(onDisk.sort()).toEqual([...AUTHORIZED_V044, `${ROOT4}/README.md`, `${ROOT4}/manifest.json`, `${ROOT4}/heic-converter/LICENSE.txt`].sort());
        expect(new Set(manifest044.asset.map(value => value.sha256)).size).toBe(manifest044.asset.length);
        expect(manifest044).toMatchObject({ schema: "iworkhere.space/value-examples/1", version: "0.4.4", generator: "script/v044ExampleFixtures.ts" });
    });
    it("record complete facts and an honest origin for every file", () => {
        for (const entry of manifest044.asset as unknown as Fact4[]) {
            expect(entry.bytes, entry.path).toBeGreaterThan(0);
            expect(entry.sha256, entry.path).toMatch(/^[0-9a-f]{64}$/);
            expect(entry.exampleId, entry.path).toMatch(/-example$/);
            if (entry.mediaType === "application/pdf") { expect(entry.pageCount, entry.path).toBeGreaterThan(0); expect(entry.page, entry.path).toHaveLength(entry.pageCount!); }
            else { expect(entry.width, entry.path).toBeGreaterThan(0); expect(entry.height, entry.path).toBeGreaterThan(0); }
            expect(entry.origin, entry.path).toBe(entry.role === "output" ? "tool-download" : entry.path.endsWith(".heic") ? "upstream-fixture" : "project-generated");
            expect(entry.operation === null, entry.path).toBe(entry.role === "source");
        }
    });
    it("match the manifest byte count, SHA-256, signature and media type, and replaced, truncated or mistyped files are detected", async () => {
        for (const entry of manifest044.asset) expect(identityProblem4(entry, new Uint8Array(await readFile(entry.path))), entry.path).toEqual([]);
        const merged = await read4("merge-pdf/result.pdf"), changed = merged.slice();
        changed[changed.length - 30] ^= 0xff;
        expect(identityProblem4(fact4("merge-pdf/result.pdf"), changed)).toContain("sha256");
        expect(identityProblem4(fact4("merge-pdf/result.pdf"), merged.subarray(0, 100))).toContain("byte count");
        expect(identityProblem4(fact4("merge-pdf/result.pdf"), await read4("image-compressor/source.jpg"))).toContain("signature/media type");
        expect(identityProblem4(fact4("heic-converter/source.heic"), await read4("heic-converter/converted.png"))).toContain("signature/media type");
        expect(identityProblem4(fact4("heic-converter/converted.png"), await read4("heic-converter/source.heic"))).toContain("signature/media type");
        const jpeg = await read4("image-compressor/compressed.jpg");
        expect(identityProblem4({ ...fact4("image-compressor/compressed.jpg"), bytes: jpeg.length - 4, sha256: sha256(jpeg.subarray(0, jpeg.length - 4)) }, jpeg.subarray(0, jpeg.length - 4))).toContain("truncated JPEG");
        await expect(readFile(`${ROOT4}/merge-pdf/absent.pdf`)).rejects.toThrow();
    });
    it("have image dimensions and PDF page facts that agree with the files themselves", async () => {
        for (const entry of manifest044.asset) {
            const bytes = new Uint8Array(await readFile(entry.path));
            if (entry.mediaType === "application/pdf") {
                const found = await inspectCompressedArtifact(bytes);
                expect(found.length, entry.path).toBe(entry.pageCount);
                expect(found.map(page => ({ width: page.width, height: page.height, rotation: page.rotation })), entry.path).toEqual(entry.page);
            } else {
                const size = entry.mediaType === "image/png" ? pngSize(bytes) : entry.mediaType === "image/jpeg" ? jpegSize(bytes) : heifSize(bytes);
                expect({ width: size.width, height: size.height }, entry.path).toEqual({ width: entry.width, height: entry.height });
            }
        }
    });
    it("are marked binary in .gitattributes so Windows line-ending handling cannot change their bytes", async () => {
        const attributes = await lines(".gitattributes");
        for (const extension of ["pdf", "png", "jpg", "heic"]) expect(attributes).toContain(`${ROOT4}/**/*.${extension} binary`);
        // Only the binary example types are listed; the readable README, manifest and LICENSE.txt keep normal text handling.
        const rule = attributes.split("\n").filter(line => line.startsWith(`${ROOT4}/`));
        expect(rule.sort()).toEqual(["pdf", "png", "jpg", "heic"].map(extension => `${ROOT4}/**/*.${extension} binary`).sort());
    });
});

describe("Merge PDF example", () => {
    it("joins both sources in the selected order, page for page, with each page's content intact", async () => {
        const [first, second, merged] = await Promise.all(["merge-pdf/source-001.pdf", "merge-pdf/source-002.pdf", "merge-pdf/result.pdf"].map(pagesOf));
        expect(first.map(labelOf)).toEqual(["A1", "A2"]);
        expect(second.map(labelOf)).toEqual(["B1", "B2", "B3"]);
        expect(merged.map(labelOf)).toEqual(["A1", "A2", "B1", "B2", "B3"]);
        [...first, ...second].forEach((page, index) => expect(samePage(page, merged[index]), `merged page ${index + 1}`).toBe(true));
        expect(merged.map(page => [page.width, page.height])).toEqual([[300, 400], [300, 400], [420, 300], [420, 300], [420, 300]]);
        expect(new Set(merged.map(page => page.raster)).size, "all five pages are visibly different").toBe(5);
    });
    it("records the selected order and the download name the tool itself would produce", () => {
        const choose = step4("merge-pdf-result").find(value => value.kind === "choose-files")!, download = step4("merge-pdf-result").find(value => value.kind === "download")!;
        expect(choose.asset).toEqual([`${ROOT4}/merge-pdf/source-001.pdf`, `${ROOT4}/merge-pdf/source-002.pdf`]);
        expect(download.filename).toBe(mergePdfFilename("source-001.pdf"));
        expect(download.saveAs).toBe(`${ROOT4}/merge-pdf/result.pdf`);
    });
    it("states counts and sizes that match the files on disk", async () => {
        const [first, second, merged] = await Promise.all(["merge-pdf/source-001.pdf", "merge-pdf/source-002.pdf", "merge-pdf/result.pdf"].map(read4));
        const outcome = getValueExample("merge-pdf")!.outcome;
        for (const bytes of [first, second, merged]) expect(outcome).toContain(`${bytes.length.toLocaleString("en-US")} bytes`);
        expect(outcome).toContain("5-page");
    });
});

describe("Split PDF example", () => {
    const groups = ["3,1", "2-3"];
    const selection = groups.map(expression => { const parsed = parsePageSelection(expression, { pageCount: 4, maxOutputCount: 100 }); if (!parsed.ok) throw new Error(expression); return parsed.page; });
    it("keeps the typed page order and allows overlap, as the tool's own selection parser defines", () => {
        expect(selection).toEqual([[3, 1], [2, 3]]);
        expect(parsePageSelection("3-1", { pageCount: 4, maxOutputCount: 100 })).toEqual({ ok: false, category: "range" });
        expect(parsePageSelection("1,1,2", { pageCount: 4, maxOutputCount: 100 })).toEqual({ ok: true, page: [1, 2] });
    });
    it("produces two independent PDFs whose pages are the selected source pages, in order, rendered identically", async () => {
        const [source, first, second] = await Promise.all(["split-pdf/source.pdf", "split-pdf/result-001.pdf", "split-pdf/result-002.pdf"].map(pagesOf));
        expect(source.map(labelOf)).toEqual(["P1", "P2", "P3", "P4"]);
        expect(new Set(source.map(page => page.raster)).size).toBe(4);
        [first, second].forEach((output, index) => {
            expect(output, `group ${index + 1} page count`).toHaveLength(selection[index].length);
            output.forEach((page, position) => expect(samePage(page, source[selection[index][position] - 1]), `group ${index + 1} position ${position + 1}`).toBe(true));
        });
        expect(first.map(labelOf)).toEqual(["P3", "P1"]);
        expect(second.map(labelOf)).toEqual(["P2", "P3"]);
        expect(first.filter(page => second.some(other => other.raster === page.raster)).map(labelOf), "the overlap is exactly page 3").toEqual(["P3"]);
    });
    it("records the groups and the download names the tool itself would produce", () => {
        const operation = step4("split-pdf-result");
        expect(operation.filter(value => value.kind === "set-text").map(value => value.value)).toEqual(groups);
        expect(operation.filter(value => value.kind === "download").map(value => value.filename)).toEqual([splitPdfFilename("source.pdf", 1, selection[0]), splitPdfFilename("source.pdf", 2, selection[1])]);
        expect(operation.filter(value => value.kind === "download").map(value => value.saveAs)).toEqual([`${ROOT4}/split-pdf/result-001.pdf`, `${ROOT4}/split-pdf/result-002.pdf`]);
    });
});

describe("Image Compressor example", () => {
    it("is a genuinely smaller, complete JPEG of the same size, and the tool's own savings rule agrees", async () => {
        const [source, output] = await Promise.all(["image-compressor/source.jpg", "image-compressor/compressed.jpg"].map(read4));
        expect(output.length).toBeLessThan(source.length);
        expect(jpegComplete(source) && jpegComplete(output)).toBe(true);
        expect(jpegSize(source)).toEqual({ width: 960, height: 640 });
        expect(jpegSize(output)).toEqual(jpegSize(source));
        const savings = imageCompressorSavings(source.length, output.length);
        expect(savings.reduced).toBe(true);
        const outcome = getValueExample("image-compressor")!.outcome;
        for (const text of [`${source.length.toLocaleString("en-US")} bytes`, `${output.length.toLocaleString("en-US")} bytes`, `${savings.bytesSaved.toLocaleString("en-US")} bytes`, `${savings.percentSaved.toFixed(1)}%`]) expect(outcome).toContain(text);
        expect(outcome).toContain("not a typical rate");
    });
    it("records a Quality the tool accepts and the download name it would produce, and the no-download case stays in the limits", () => {
        const operation = step4("image-compressor-compressed");
        expect(operation.find(value => value.control === "Quality")!.value).toBe("40");
        expect(validateImageCompressorQuality(40)).toBeNull();
        expect(validateImageCompressorQuality(42)).not.toBeNull();
        expect(operation.find(value => value.kind === "download")!.filename).toBe(imageCompressorFilename("source.jpg", "jpeg"));
        expect(imageCompressorSavings(100, 100)).toEqual({ reduced: false, bytesSaved: 0, percentSaved: 0 });
        expect(getValueExample("image-compressor")!.limitation.join(" ")).toContain("No smaller file produced");
    });
});

describe("HEIC Converter example", () => {
    it("starts from the verified upstream fixture, byte for byte", async () => {
        const source = await read4("heic-converter/source.heic"), fixture = new Uint8Array(await readFile("test/fixtures/images/heic-source.heic"));
        expect(Buffer.from(source).equals(Buffer.from(fixture))).toBe(true);
        expect(source.length).toBe(3554);
        expect(sha256(source)).toBe("b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119");
        expect(createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${source.length}${String.fromCharCode(0)}`), source])).digest("hex")).toBe("c6da5cea205f31fe2eab42c704583ee35f1dd27f");
        expect(isHeif(source)).toBe(true);
        expect(heifSize(source)).toEqual({ width: 480, height: 320 });
    });
    it("ships the pinned upstream MIT license under a notice that the file is not project-authored", async () => {
        const license = await lines(`${ROOT4}/heic-converter/LICENSE.txt`), pinned = await lines("test/fixtures/images/licenses/heic-web-MIT.txt");
        expect(license).toContain("NOT project-authored");
        expect(license.endsWith(pinned), "the upstream license text is reproduced unchanged").toBe(true);
        for (const text of ["3261b10a31625dcb395b82081b3e9f7d10c9fc2c", "c6da5cea205f31fe2eab42c704583ee35f1dd27f", "b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119", "su-engineering/heic-web", "MIT"]) expect(license, text).toContain(text);
        expect(manifest044.upstream).toEqual([{
            path: `${ROOT4}/heic-converter/source.heic`, repository: "https://github.com/su-engineering/heic-web", commit: "3261b10a31625dcb395b82081b3e9f7d10c9fc2c",
            upstreamPath: "test/fixtures/generated/asym-base.heic", gitBlob: "c6da5cea205f31fe2eab42c704583ee35f1dd27f", license: "MIT", licensePath: `${ROOT4}/heic-converter/LICENSE.txt`,
        }]);
    });
    it("converts to a 480 × 320 PNG with the expected shapes at known points, and a JPEG of the same size", async () => {
        const png = decodePng(await read4("heic-converter/converted.png"));
        expect([png.width, png.height]).toEqual([480, 320]);
        expect(png.pixel(60, 40)).toEqual([221, 60, 50, 255]);
        expect(png.pixel(420, 40)).toEqual([59, 201, 89, 255]);
        expect(png.pixel(220, 120)).toEqual([255, 255, 255, 255]);
        expect(png.pixel(65, 160)).toEqual([180, 180, 180, 255]);
        expect(png.pixel(60, 280)).toEqual([70, 121, 240, 255]);
        expect(png.pixel(420, 280)).toEqual([240, 211, 58, 255]);
        expect(png.pixel(300, 200)).toEqual([30, 30, 40, 255]);
        const jpeg = await read4("heic-converter/converted.jpg");
        expect(jpegComplete(jpeg)).toBe(true);
        expect(jpegSize(jpeg)).toEqual({ width: 480, height: 320 });
    });
    it("records settings the tool accepts and the download names it would produce", () => {
        const jpeg = step4("heic-converter-jpeg"), png = step4("heic-converter-png");
        expect(heicQuality("jpeg", Number(jpeg.find(value => value.control === "Quality")!.value))).toBe(0.9);
        expect(png.some(value => value.control === "Quality"), "PNG has no Quality control").toBe(false);
        expect(heicQuality("png")).toBeUndefined();
        expect(jpeg.find(value => value.kind === "download")!.filename).toBe(heicFilename("source.heic", "jpeg"));
        expect(png.find(value => value.kind === "download")!.filename).toBe(heicFilename("source.heic", "png"));
    });
});

describe("v0.4.4 descriptions, provenance and reproduction", () => {
    const assets4 = () => ["merge-pdf", "split-pdf", "image-compressor", "heic-converter"].flatMap(id => { const value = getValueExample(id)!; return [...value.source, ...value.output]; });
    const description4 = (file: string) => assets4().find(asset => asset.path === `${ROOT4}/${file}`)!.description;

    it("describe the pages, orientation and counts that PDF.js finds in the committed PDFs", async () => {
        const count = ["", "one", "two", "three", "four", "five"];
        for (const file of ["merge-pdf/source-001.pdf", "merge-pdf/source-002.pdf", "merge-pdf/result.pdf", "split-pdf/source.pdf", "split-pdf/result-001.pdf", "split-pdf/result-002.pdf"]) {
            const page = await pagesOf(file);
            expect(description4(file), file).toContain(`${count[page.length]}-page`);
        }
        for (const label of ["A1", "A2"]) expect(description4("merge-pdf/source-001.pdf")).toContain(label);
        for (const label of ["B1", "B2", "B3"]) expect(description4("merge-pdf/source-002.pdf")).toContain(label);
        expect((await pagesOf("merge-pdf/source-001.pdf"))[0].height).toBeGreaterThan((await pagesOf("merge-pdf/source-001.pdf"))[0].width);
        expect(description4("merge-pdf/source-001.pdf")).toContain("portrait");
        expect((await pagesOf("merge-pdf/source-002.pdf"))[0].width).toBeGreaterThan((await pagesOf("merge-pdf/source-002.pdf"))[0].height);
        expect(description4("merge-pdf/source-002.pdf")).toContain("landscape");
        expect(description4("split-pdf/result-001.pdf")).toContain("P3, P1");
        expect(description4("split-pdf/result-002.pdf")).toContain("P2, P3");
    });
    it("describe the HEIC conversion only with shapes and colors that are present in the decoded PNG", async () => {
        const png = decodePng(await read4("heic-converter/converted.png"));
        const [red, green, white, grey, blue, yellow, background] = [png.pixel(60, 40), png.pixel(420, 40), png.pixel(220, 120), png.pixel(65, 160), png.pixel(60, 280), png.pixel(420, 280), png.pixel(300, 200)];
        expect(red[0]).toBeGreaterThan(200); expect(red[1]).toBeLessThan(90);
        expect(green[1]).toBeGreaterThan(180); expect(green[0]).toBeLessThan(90);
        expect(white.slice(0, 3)).toEqual([255, 255, 255]);
        expect(Math.max(...grey.slice(0, 3)) - Math.min(...grey.slice(0, 3))).toBe(0);
        expect(blue[2]).toBeGreaterThan(200); expect(blue[0]).toBeLessThan(100);
        expect(yellow[0]).toBeGreaterThan(230); expect(yellow[2]).toBeLessThan(90);
        expect(Math.max(...background.slice(0, 3))).toBeLessThan(50);
        const sentence = description4("heic-converter/converted.jpg");
        for (const text of ["dark navy", "red rectangle at the top left", "white right triangle", "green rectangle at the top right", "grey bar", "blue rectangle at the bottom left", "yellow circle at the bottom right"]) expect(sentence, text).toContain(text);
        expect(description4("heic-converter/converted.png")).toContain("lossless PNG");
    });
    it("describe the compressor scene and keep claims about quality to what was measured", async () => {
        expect(description4("image-compressor/source.jpg")).toMatch(/red house.*green hills.*yellow sun/);
        expect(description4("image-compressor/compressed.jpg")).toContain("Quality 40");
        expect(jpegSize(await read4("image-compressor/source.jpg"))).toEqual(jpegSize(await read4("image-compressor/compressed.jpg")));
    });
    it("keep the README and provenance text aligned, with the HEIC input never called project-authored", async () => {
        const readme = await lines(`${ROOT4}/README.md`);
        for (const file of AUTHORIZED_V044) expect(readme, file).toContain(file.slice(ROOT4.length + 1));
        for (const text of ["LICENSE.txt", "MIT", "3261b10a31625dcb395b82081b3e9f7d10c9fc2c", "b8cc78079ada0b88066eb6e406735946064b51f5690389eebd556614a1133119", "script/v044ExampleFixtures.ts", "--output-root", "Not project-authored", "No such file is included", "differ"]) expect(readme, text).toContain(text);
        const heic = getValueExample("heic-converter")!.provenance.permission;
        expect(heic).toMatch(/not project-authored/);
        expect(heic).toContain("MIT");
        expect(heic).not.toContain("Original to iworkhere.space");
        for (const id of ["merge-pdf", "split-pdf", "image-compressor"]) expect(getValueExample(id)!.provenance.permission, id).toMatch(/^Original to iworkhere\.space/);
    });
    it("use only control labels, headings and option values that exist in the real tool source", async () => {
        const toolSource: Record<string, string> = { "merge-pdf": "document/MergePdfTool.tsx", "split-pdf": "document/SplitPdfTool.tsx", "image-compressor": "image/ImageCompressorTool.tsx", "heic-converter": "image/HeicConverterTool.tsx" };
        for (const operation of manifest044.operation) {
            expect(NEW_TOOL).toContain(operation.toolId);
            // The Image Compressor's file chooser is owned by ImageSourcePanel.
            const shared = operation.toolId === "image-compressor" ? await readFile("src/component/tool/image/ImageSourcePanel.tsx", "utf8") : "";
            const source = `${await readFile(path.join("src/module/tool", toolSource[operation.toolId]), "utf8")}\n${shared}`;
            for (const step of operation.step as Step4[]) {
                // Group controls are numbered at render time: "Pages for output group {index + 1}".
                const control = step.control.replace(/ group \d+$/, " group");
                expect(source.includes(control), `${operation.id}: ${step.control}`).toBe(true);
                if (step.waitForHeading) expect(source.includes(step.waitForHeading), `${operation.id}: ${step.waitForHeading}`).toBe(true);
                if (step.kind === "choose-option") expect(["jpeg", "png"], `${operation.id}: option`).toContain(step.value);
            }
        }
    });
    it("only demonstrate settings, groups, files and limits the tools allow, and every download is a recorded output", async () => {
        for (const operation of manifest044.operation) {
            const steps = operation.step as Step4[];
            for (const step of steps.filter(value => value.control === "Quality")) {
                const quality = Number(step.value);
                if (operation.toolId === "heic-converter") expect(() => heicQuality("jpeg", quality)).not.toThrow();
                else expect(validateImageCompressorQuality(quality)).toBeNull();
            }
            const group = steps.filter(value => value.control.startsWith("Pages for output group"));
            expect(group.length).toBeLessThanOrEqual(20);
            for (const step of group) expect(parsePageSelection(step.value!, { pageCount: 4, maxOutputCount: 100 }).ok, step.value).toBe(true);
            for (const step of steps.filter(value => value.kind === "choose-files")) {
                const chosen = await Promise.all(step.asset!.map(async file => ({ file, bytes: new Uint8Array(await readFile(file)) })));
                for (const { file } of chosen) expect(manifest044.asset.find(value => value.path === file)?.role, file).toBe("source");
                if (operation.toolId === "merge-pdf") { expect(chosen.length).toBeGreaterThanOrEqual(2); expect(chosen.length).toBeLessThanOrEqual(10); expect(chosen.every(value => value.bytes.length <= 10 * 1024 * 1024)).toBe(true); }
                else expect(chosen).toHaveLength(1);
                expect(chosen.every(value => value.bytes.length <= 25 * 1024 * 1024)).toBe(true);
            }
            for (const step of steps.filter(value => value.kind === "download")) expect(manifest044.asset.find(value => value.path === step.saveAs), step.saveAs).toMatchObject({ role: "output", operation: operation.id, exampleId: operation.exampleId });
        }
        const produced = manifest044.operation.flatMap(operation => (operation.step as Step4[]).filter(value => value.kind === "download").map(value => value.saveAs));
        expect(produced.sort()).toEqual(manifest044.asset.filter(value => value.role === "output").map(value => value.path).sort());
    });
});
