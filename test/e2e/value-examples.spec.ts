import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixture";
import manifest from "../../public/examples/v0.4.3/manifest.json";
import { inspectCompressedArtifact } from "../compressPdfVerification";
import { referencePdfRaster } from "../pdfToImageVerification";
import { runExampleOperation, type ExampleOperation } from "../../script/v043ExampleFixtures";

const ROOT = "public/examples/v0.4.3";
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
