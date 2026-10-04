import { readFile } from "node:fs/promises";
import { readPdfAssetManifest, verifyPdfAssetManifest } from "./pdfAssetManifest";
async function main() {
    for (const root of ["public/vendor/pdfjs/6.4.299", "public/vendor/qpdf/12.4.2"]) {
        const manifest = readPdfAssetManifest(JSON.parse(await readFile(`${root}/manifest.json`, "utf8")));
        await verifyPdfAssetManifest(root, manifest);
    }
    await verifyPdfAssetManifest("public/licenses", readPdfAssetManifest(JSON.parse(await readFile("public/licenses/pdf-foundation-manifest.json", "utf8"))));
    process.stdout.write("PDF_RUNTIME_CHECKSUMS_AND_NOTICES: PASS\n");
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "PDF assets failed"}\n`); process.exitCode = 1; });
