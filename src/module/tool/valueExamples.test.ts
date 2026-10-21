import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import manifest from "../../../public/examples/v0.4.3/manifest.json";
import { inspectCompressedArtifact } from "../../../test/compressPdfVerification";
import { inspectImagePdf } from "../../../test/imagesToPdfVerification";
import { detectImageFileFormat } from "./image/imageFile";
import { heightFromWidth } from "./image/imageResizer";
import { tool_definition_list } from "./registry";
import { getAllValueExample, getValueExample } from "./valueExamples";

const ROOT = "public/examples/v0.4.3";
const FEATURED = ["compress-pdf", "pdf-to-image", "images-to-pdf", "image-resizer", "image-converter"];
const EXAMPLE_ID = FEATURED.map(id => `${id}-example`);
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
    it("define exactly the five approved featured tools with stable unique IDs", () => {
        const example = getAllValueExample();
        expect(example.map(value => value.id)).toEqual(EXAMPLE_ID);
        expect(example.map(value => value.toolId)).toEqual(FEATURED);
        expect(new Set(example.map(value => value.id)).size).toBe(5);
        expect(manifest.asset.map(value => value.exampleId).filter((value, index, list) => list.indexOf(value) === index).sort()).toEqual([...EXAMPLE_ID].sort());
    });
    it("resolve every featured tool through the existing registry and return nothing for any other tool", () => {
        const registered = tool_definition_list.map(tool => tool.id);
        for (const id of FEATURED) { expect(registered).toContain(id); expect(getValueExample(id)?.toolId).toBe(id); }
        for (const id of registered.filter(value => !FEATURED.includes(value))) expect(getValueExample(id), id).toBeUndefined();
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
        expect(assets().map(asset => asset.path).sort()).toEqual([...AUTHORIZED].sort());
        for (const asset of assets()) {
            const recorded = manifest.asset.find(value => value.path === asset.path)!;
            expect(asset.description.trim().length, asset.path).toBeGreaterThan(20);
            expect({ bytes: asset.bytes, sha256: asset.sha256, mediaType: asset.mediaType }, asset.path).toEqual({ bytes: recorded.bytes, sha256: recorded.sha256, mediaType: recorded.mediaType });
            expect(Object.keys(recorded), "descriptions must not be written into the manifest").not.toContain("description");
        }
    });
    it("describe each image in a sentence that does not merely restate its filename, format or size", () => {
        for (const asset of assets().filter(value => value.mediaType.startsWith("image/"))) {
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
