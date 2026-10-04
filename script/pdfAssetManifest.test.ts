import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { readPdfAssetManifest, verifyPdfAssetManifest } from "./pdfAssetManifest";
it("verifies every pinned runtime identity and notice", async () => {
    for (const root of ["public/vendor/pdfjs/6.4.299", "public/vendor/qpdf/12.4.2"]) await verifyPdfAssetManifest(root, readPdfAssetManifest(JSON.parse(await readFile(`${root}/manifest.json`, "utf8"))));
    await verifyPdfAssetManifest("public/licenses", readPdfAssetManifest(JSON.parse(await readFile("public/licenses/pdf-foundation-manifest.json", "utf8"))));
});
it("fails closed for malformed, duplicate or traversing manifest entries", async () => {
    const manifest = JSON.parse(await readFile("public/vendor/qpdf/12.4.2/manifest.json", "utf8"));
    for (const value of [null, {}, { ...manifest, asset: [] }, { ...manifest, asset: [...manifest.asset, manifest.asset[0]] }, { ...manifest, asset: [{ ...manifest.asset[0], path: "../outside" }] }, { ...manifest, asset: [{ ...manifest.asset[0], sha256: "bad" }] }]) expect(() => readPdfAssetManifest(value)).toThrow();
    await expect(verifyPdfAssetManifest("public/vendor/qpdf/12.4.2", { ...manifest, asset: [{ ...manifest.asset[0], sha256: "0".repeat(64) }] })).rejects.toThrow("identity mismatch");
});
