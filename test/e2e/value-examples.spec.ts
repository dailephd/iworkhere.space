import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";
import manifest from "../../public/examples/v0.4.3/manifest.json";
import manifest044 from "../../public/examples/v0.4.4/manifest.json";
import { inspectCompressedArtifact } from "../compressPdfVerification";
import { referencePdfRaster } from "../pdfToImageVerification";
import { runExampleOperation, type ExampleOperation } from "../../script/v043ExampleFixtures";
import { runExampleOperation as runAddedOperation, type ExampleOperation as AddedOperation } from "../../script/v044ExampleFixtures";

const ROOT = "public/examples/v0.4.3";
const ROOT4 = "public/examples/v0.4.4";
const url = (file: string) => `/${file.slice("public/".length)}`;
const read = async (file: string) => new Uint8Array(await readFile(path.resolve(file)));

interface Decoded { width: number; height: number; pixel: number[][] }
/** Native browser decode of the committed bytes; returns pixels at the requested points. */
async function decode(page: Page, bytes: Uint8Array, mediaType: string, point: number[][]): Promise<Decoded> {
    return page.evaluate(async ({ data, type, point }) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type }));
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        try {
            const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0);
            return { width: bitmap.width, height: bitmap.height, pixel: point.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]) };
        } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
    }, { data: [...bytes], type: mediaType, point });
}
const near = (actual: number[], expected: number[], tolerance: number) => expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);

/** Mean and largest per-channel difference between two natively decoded images of the same size (alpha ignored). */
async function difference(page: Page, left: { bytes: Uint8Array; type: string }, right: { bytes: Uint8Array; type: string }) {
    return page.evaluate(async ({ a, b }) => {
        const pixels = async (data: number[], type: string) => {
            const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type }));
            const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
            try { const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0); return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data }; }
            finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
        };
        const [first, second] = [await pixels(a.data, a.type), await pixels(b.data, b.type)];
        if (first.width !== second.width || first.height !== second.height) return { sameSize: false, mean: 0, max: 0 };
        let total = 0, max = 0;
        for (let index = 0; index < first.data.length; index += 4) for (let channel = 0; channel < 3; channel++) {
            const change = Math.abs(first.data[index + channel] - second.data[index + channel]);
            total += change; if (change > max) max = change;
        }
        return { sameSize: true, mean: total / (first.width * first.height * 3), max };
    }, { a: { data: [...left.bytes], type: left.type }, b: { data: [...right.bytes], type: right.type } });
}

test.describe("v0.4.3 value examples", () => {
    test("every committed asset is served from the site with its manifest identity and media type", async ({ request }) => {
        for (const asset of manifest.asset) {
            const response = await request.get(url(asset.path));
            expect(response.status(), asset.path).toBe(200);
            expect(response.headers()["content-type"], asset.path).toContain(asset.mediaType);
            const body = await response.body();
            expect(body.length, asset.path).toBe(asset.bytes);
            expect(createHash("sha256").update(body).digest("hex"), asset.path).toBe(asset.sha256);
        }
    });

    test("images decode natively at the recorded size", async ({ page }) => {
        await page.goto("/");
        for (const asset of manifest.asset.filter(value => value.mediaType.startsWith("image/"))) {
            const decoded = await decode(page, await read(asset.path), asset.mediaType, [[0, 0]]);
            expect({ width: decoded.width, height: decoded.height }, asset.path).toEqual({ width: asset.width, height: asset.height });
        }
    });

    test("Image Converter: JPEG is flattened to white, WebP keeps transparency and color", async ({ page }) => {
        await page.goto("/");
        const hole = [140, 160], corner = [2, 2], ring = [140, 230], rectangle = [350, 100], triangle = [350, 250];
        const jpeg = await decode(page, await read(`${ROOT}/image-converter/converted.jpg`), "image/jpeg", [corner, hole, ring, rectangle, triangle]);
        expect(near(jpeg.pixel[0], [255, 255, 255, 255], 6), "transparent corner becomes white").toBe(true);
        expect(near(jpeg.pixel[1], [255, 255, 255, 255], 6), "transparent hole becomes white").toBe(true);
        expect(jpeg.pixel.every(value => value[3] === 255), "JPEG has no alpha").toBe(true);
        expect(near(jpeg.pixel[2], [230, 57, 70, 255], 24)).toBe(true);
        expect(near(jpeg.pixel[3], [29, 78, 216, 255], 24)).toBe(true);
        expect(near(jpeg.pixel[4], [42, 157, 143, 255], 24)).toBe(true);
        const webp = await decode(page, await read(`${ROOT}/image-converter/converted.webp`), "image/webp", [corner, hole, ring, rectangle, triangle]);
        expect(webp.pixel[0][3], "corner stays transparent").toBe(0);
        expect(webp.pixel[1][3], "hole stays transparent").toBe(0);
        expect(near(webp.pixel[2], [230, 57, 70, 255], 24)).toBe(true);
        expect(near(webp.pixel[3], [29, 78, 216, 255], 24)).toBe(true);
        expect(near(webp.pixel[4], [42, 157, 143, 255], 24)).toBe(true);
    });

    test("Image Resizer: the committed output is the source halved with its corner markers intact", async ({ page }) => {
        await page.goto("/");
        const marker = [[64, 64, [214, 40, 40]], [736, 64, [42, 157, 143]], [64, 536, [29, 78, 216]], [736, 536, [244, 180, 0]]] as const;
        const source = await decode(page, await read(`${ROOT}/image-resizer/source.png`), "image/png", marker.map(([x, y]) => [x, y]));
        const output = await decode(page, await read(`${ROOT}/image-resizer/resized.png`), "image/png", marker.map(([x, y]) => [x / 2, y / 2]));
        expect([source.width, source.height, output.width, output.height]).toEqual([800, 600, 400, 300]);
        marker.forEach(([, , color], index) => { expect(near(source.pixel[index], [...color, 255], 0)).toBe(true); expect(near(output.pixel[index], [...color, 255], 12)).toBe(true); });
    });

    test("PDF to Image: committed images match independent PDF.js reference rasters and identify their page", async ({ page }) => {
        await page.goto("/");
        const source = await read(`${ROOT}/pdf-to-image/source.pdf`);
        const reference = [await referencePdfRaster(source, 1, 150), await referencePdfRaster(source, 2, 150)];
        const output = [{ file: "page-001.png", type: "image/png" }, { file: "page-002.jpg", type: "image/jpeg" }];
        const actual: { width: number; height: number; sample: number[][]; label: number[] }[] = [];
        for (const [index, { file, type }] of output.entries()) {
            const bytes = await read(`${ROOT}/pdf-to-image/${file}`), expected = reference[index];
            const result = await page.evaluate(async ({ data, type, expected }) => {
                const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type }));
                const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
                try {
                    const context = canvas.getContext("2d")!; context.drawImage(bitmap, 0, 0);
                    const label = expected.label;
                    return { width: bitmap.width, height: bitmap.height, sample: expected.sample.map(point => [...context.getImageData(point.x, point.y, 1, 1).data]), label: [...context.getImageData(label.x, label.y, label.width, label.height).data] };
                } finally { bitmap.close(); }
            }, { data: [...bytes], type, expected });
            expect({ width: result.width, height: result.height }, file).toEqual({ width: expected.width, height: expected.height });
            const difference = result.sample.flatMap((pixel, point) => pixel.map((value, channel) => Math.abs(value - expected.sample[point].pixel[channel])));
            expect(Math.max(...difference), file).toBeLessThanOrEqual(type === "image/png" ? 0 : 6);
            actual.push(result);
        }
        const distance = (value: number[], target: number[]) => value.reduce((sum, item, index) => sum + Math.abs(item - target[index]), 0) / value.length;
        // The pages differ visibly (distinct tint) and each committed image is close to its own page's reference label, not merely to some page.
        expect(near(reference[0].sample[0].pixel, reference[1].sample[0].pixel, 20), "the two source pages have different backgrounds").toBe(false);
        expect(distance(actual[0].label, reference[0].label.pixel)).toBeLessThanOrEqual(8); // text antialiasing differs slightly between Node and Chromium rasterizers
        expect(distance(actual[1].label, reference[1].label.pixel)).toBeLessThanOrEqual(8);
    });

    test("every recorded operation, run on the real tool with the committed source, reproduces the committed result", async ({ page, baseURL }) => {
        test.setTimeout(240_000);
        for (const operation of manifest.operation as ExampleOperation[]) {
            const saveAs = operation.step.find(step => step.kind === "download")!;
            if (saveAs.kind !== "download") throw new Error("Unreachable");
            const committed = manifest.asset.find(value => value.path === saveAs.saveAs)!, committedBytes = await read(committed.path);
            const bytes = await runExampleOperation(page, baseURL!, operation);
            if (committed.mediaType === "application/pdf") {
                const [fresh, expected] = [await inspectCompressedArtifact(bytes), await inspectCompressedArtifact(committedBytes)];
                expect(fresh, operation.id).toEqual(expected);
                // QPDF is deterministic, so the compressed file must be identical byte for byte; browser/pdf-lib output need only match page for page.
                if (operation.toolId === "compress-pdf") expect(Buffer.from(bytes).equals(Buffer.from(committedBytes)), operation.id).toBe(true);
                else expect(fresh.length, operation.id).toBe(committed.pageCount);
            } else {
                const point = [[2, 2]];
                const [fresh, expected] = [await decode(page, bytes, committed.mediaType, point), await decode(page, committedBytes, committed.mediaType, point)];
                expect({ width: fresh.width, height: fresh.height }, operation.id).toEqual({ width: expected.width, height: expected.height });
                expect(near(fresh.pixel[0], expected.pixel[0], 12), `${operation.id}: corner pixel`).toBe(true);
            }
        }
    });
});

test.describe("v0.4.4 value examples", () => {
    const served = async (request: { get(url: string): Promise<{ body(): Promise<Buffer> }> }, file: string) => new Uint8Array(await (await request.get(url(`${ROOT4}/${file}`))).body());
    const shape = [[60, 40, [221, 60, 50]], [420, 40, [59, 201, 89]], [220, 120, [255, 255, 255]], [65, 160, [180, 180, 180]], [60, 280, [70, 121, 240]], [420, 280, [240, 211, 58]], [300, 200, [30, 30, 40]]] as const;

    test("every committed asset is served from the site with its manifest identity, size and media type", async ({ request }) => {
        for (const asset of manifest044.asset) {
            const response = await request.get(url(asset.path));
            expect(response.status(), asset.path).toBe(200);
            expect(response.headers()["content-type"], asset.path).toContain(asset.mediaType);
            const body = await response.body();
            expect(body.length, asset.path).toBe(asset.bytes);
            expect(createHash("sha256").update(body).digest("hex"), asset.path).toBe(asset.sha256);
        }
        const license = await request.get(url(`${ROOT4}/heic-converter/LICENSE.txt`));
        expect(license.status()).toBe(200);
        expect(await license.text()).toContain("NOT project-authored");
    });

    test("the JPEG and PNG files decode natively at the recorded size", async ({ page }) => {
        await page.goto("/");
        for (const asset of manifest044.asset.filter(value => value.mediaType === "image/png" || value.mediaType === "image/jpeg")) {
            const decoded = await decode(page, await read(asset.path), asset.mediaType, [[0, 0]]);
            expect({ width: decoded.width, height: decoded.height }, asset.path).toEqual({ width: asset.width, height: asset.height });
        }
    });

    test("Merge PDF and Split PDF files, fetched from the site, hold exactly the selected pages in order", async ({ request }) => {
        const pages = async (file: string) => inspectCompressedArtifact(await served(request, file));
        const label = (page: { text: string }) => (JSON.parse(page.text) as string[][])[0][0];
        const [first, second, merged] = [await pages("merge-pdf/source-001.pdf"), await pages("merge-pdf/source-002.pdf"), await pages("merge-pdf/result.pdf")];
        expect(merged.map(label)).toEqual(["A1", "A2", "B1", "B2", "B3"]);
        [...first, ...second].forEach((page, index) => expect(page.raster, `merged page ${index + 1} renders like its source page`).toBe(merged[index].raster));
        const [source, one, two] = [await pages("split-pdf/source.pdf"), await pages("split-pdf/result-001.pdf"), await pages("split-pdf/result-002.pdf")];
        expect(source.map(label)).toEqual(["P1", "P2", "P3", "P4"]);
        expect(one.map(label)).toEqual(["P3", "P1"]);
        expect(two.map(label)).toEqual(["P2", "P3"]);
        one.forEach((page, index) => expect(page.raster).toBe(source[[2, 0][index]].raster));
        two.forEach((page, index) => expect(page.raster).toBe(source[[1, 2][index]].raster));
    });

    test("Image Compressor: the output is smaller, same size, visibly the same scene and not an unchanged copy", async ({ page }) => {
        await page.goto("/");
        const [source, output] = [await read(`${ROOT4}/image-compressor/source.jpg`), await read(`${ROOT4}/image-compressor/compressed.jpg`)];
        expect(output.length).toBeLessThan(source.length);
        const change = await difference(page, { bytes: source, type: "image/jpeg" }, { bytes: output, type: "image/jpeg" });
        expect(change.sameSize).toBe(true);
        expect(change.mean, "lossy compression changed some pixels").toBeGreaterThan(0.2);
        expect(change.mean, "but the picture is still the same scene").toBeLessThan(6);
        const point = [[780, 120], [480, 250], [400, 340], [5, 5]];
        const [before, after] = [await decode(page, source, "image/jpeg", point), await decode(page, output, "image/jpeg", point)];
        before.pixel.forEach((value, index) => expect(near(after.pixel[index], value, 24), `sample ${point[index]}`).toBe(true));
        expect(near(after.pixel[0], [255, 214, 90, 255], 24), "the sun is still yellow").toBe(true);
    });

    test("HEIC Converter: the PNG and JPEG carry the same shapes at known points and agree with each other", async ({ page }) => {
        await page.goto("/");
        const [png, jpeg] = [await read(`${ROOT4}/heic-converter/converted.png`), await read(`${ROOT4}/heic-converter/converted.jpg`)];
        const point = shape.map(([x, y]) => [x, y]);
        const [lossless, lossy] = [await decode(page, png, "image/png", point), await decode(page, jpeg, "image/jpeg", point)];
        expect([lossless.width, lossless.height, lossy.width, lossy.height]).toEqual([480, 320, 480, 320]);
        shape.forEach(([x, y, color], index) => {
            expect(near(lossless.pixel[index], [...color, 255], 0), `PNG ${x},${y}`).toBe(true);
            expect(near(lossy.pixel[index], [...color, 255], 24), `JPEG ${x},${y}`).toBe(true);
        });
        const change = await difference(page, { bytes: png, type: "image/png" }, { bytes: jpeg, type: "image/jpeg" });
        expect(change.sameSize).toBe(true);
        expect(change.mean).toBeLessThan(4);
    });

    test("every recorded operation, run on the real tool with the committed sources, reproduces the committed results", async ({ page, baseURL }) => {
        test.setTimeout(300_000);
        const label = (evidence: { text: string }) => (JSON.parse(evidence.text) as string[][])[0][0];
        for (const operation of manifest044.operation as unknown as AddedOperation[]) {
            const downloads = await runAddedOperation(page, baseURL!, operation);
            expect(downloads.map(value => value.saveAs), operation.id).toEqual(operation.step.flatMap(step => step.kind === "download" ? [step.saveAs] : []));
            for (const { saveAs, bytes } of downloads) {
                const committed = manifest044.asset.find(value => value.path === saveAs)!, committedBytes = await read(committed.path);
                if (committed.mediaType === "application/pdf") {
                    // pdf-lib output bytes vary between runs; the pages must not: same size, text and rendered pixels, in the same order.
                    const [fresh, expected] = [await inspectCompressedArtifact(bytes), await inspectCompressedArtifact(committedBytes)];
                    expect(fresh, saveAs).toEqual(expected);
                    expect(fresh.map(label), saveAs).toEqual(expected.map(label));
                } else {
                    const change = await difference(page, { bytes, type: committed.mediaType }, { bytes: committedBytes, type: committed.mediaType });
                    expect(change.sameSize, saveAs).toBe(true);
                    expect(change.mean, `${saveAs}: decoded pixels`).toBeLessThan(1);
                    if (operation.toolId === "image-compressor") expect(bytes.length, "a fresh run is also smaller than the source").toBeLessThan((await read(`${ROOT4}/image-compressor/source.jpg`)).length);
                }
            }
        }
    });

    test("Image Compressor: a result that is not smaller shows No smaller file produced and offers no download", async ({ page }) => {
        await page.goto("/tool/image-compressor");
        await page.getByLabel("Choose image", { exact: true }).setInputFiles(path.resolve("test/fixtures/images/resizer-source.png"));
        await page.getByRole("button", { name: "Compress image", exact: true }).click();
        await expect(page.getByRole("heading", { name: "No smaller file produced", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Download compressed image" })).toHaveCount(0);
        await expect(page.getByRole("img", { name: "Compressed image preview" })).toHaveCount(0);
    });
});
