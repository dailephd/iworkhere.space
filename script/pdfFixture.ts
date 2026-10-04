import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface FixtureIdentity { name: string; bytes: number; sha256: string; purpose: string }
interface FixtureQpdf { FS: { writeFile(name: string, bytes: Uint8Array): void; readFile(name: string): Uint8Array }; callMain(argument: string[]): number }
async function main(): Promise<void> {
    const root = path.resolve("test/fixtures/pdf");
    await mkdir(root, { recursive: true });
    const identity: FixtureIdentity[] = [];
    async function save(name: string, bytes: Uint8Array, purpose: string) {
        await writeFile(path.join(root, name), bytes);
        identity.push({ name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), purpose });
    }
    async function generate(name: string, count: number, kind: "text" | "jpeg" | "png" | "mixed" | "rotated" | "dimensions" | "large" | "fonts") {
        const document = await PDFDocument.create();
        document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0));
        document.setProducer("iworkhere.space deterministic fixture"); document.setCreator("iworkhere.space");
        const fonts = kind === "fonts" ? Object.values(StandardFonts) : [StandardFonts.Helvetica];
        const font = await Promise.all(fonts.map(value => document.embedFont(value)));
        const jpeg = kind === "jpeg" || kind === "mixed" ? await document.embedJpg(await readFile("test/fixtures/images/resizer-source.jpg")) : null;
        const png = kind === "png" || kind === "mixed" ? await document.embedPng(await readFile("test/fixtures/images/resizer-source.png")) : null;
        for (let index = 0; index < count; index++) {
            const size: [number, number] = kind === "large" ? [4097, 4097] : kind === "dimensions" && index % 2 ? [240, 180] : [320, 240];
            const page = document.addPage(size);
            if (kind === "rotated") page.setRotation(degrees(90));
            page.drawRectangle({ x: 10, y: 10, width: 50, height: 30, color: rgb(0.2, 0.6, 0.8) });
            for (let row = 0; row < font.length; row++) {
                const label = fonts[row] === StandardFonts.Symbol ? "α" : fonts[row] === StandardFonts.ZapfDingbats ? "✂" : `Page ${index + 1}`;
                page.drawText(label, { x: 20, y: 210 - row * 13, size: 10, font: font[row] });
            }
            if (jpeg) page.drawImage(jpeg, { x: 90, y: 20, width: 160, height: 120 });
            if (png) page.drawImage(png, { x: 150, y: 90, width: 80, height: 60 });
        }
        const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
        await save(name, bytes, kind);
        return bytes;
    }
    const text = await generate("text-vector.pdf", 1, "text");
    await generate("jpeg-heavy.pdf", 1, "jpeg"); await generate("png-heavy.pdf", 1, "png");
    await generate("mixed.pdf", 2, "mixed"); await generate("rotated.pdf", 1, "rotated");
    await generate("mixed-dimensions.pdf", 2, "dimensions"); await generate("ordering.pdf", 4, "text");
    await generate("multipage.pdf", 3, "text"); await generate("large-page-box.pdf", 1, "large");
    await generate("standard-fonts.pdf", 1, "fonts"); await generate("page-limit.pdf", 101, "text");
    await save("truncated.pdf", text.slice(0, 70), "truncated real source");
    await save("invalid-body.pdf", new TextEncoder().encode("%PDF-1.7\ninvalid body\n%%EOF"), "invalid body");
    await save("false-signature.pdf", new TextEncoder().encode("%PDF-not-a-version\n"), "false header");
    const damaged = Buffer.from(text).toString("latin1").replace(/startxref\s+\d+/, "startxref\n0");
    await save("damaged-xref.pdf", Buffer.from(damaged, "latin1"), "recoverable damaged xref; no repair guarantee");
    const temp = path.resolve(".my-dev-kit-workflow/v0.3.0-batch1/fixture-generator");
    await mkdir(temp, { recursive: true });
    await copyFile("public/vendor/qpdf/12.4.2/qpdf.js", path.join(temp, "qpdf.mjs"));
    const factory = await import(pathToFileURL(path.join(temp, "qpdf.mjs")).href);
    const runtime: FixtureQpdf = await factory.default({ locateFile: () => path.resolve("public/vendor/qpdf/12.4.2/qpdf.wasm"), print: () => {}, printErr: () => {} });
    runtime.FS.writeFile("/input.pdf", text);
    const result = runtime.callMain(["--static-id", "--static-aes-iv", "--encrypt", "reader", "owner", "128", "--use-aes=y", "--", "/input.pdf", "/encrypted.pdf"]);
    if (result !== 0) throw new Error("Encrypted fixture generation failed");
    await save("encrypted.pdf", runtime.FS.readFile("/encrypted.pdf"), "AES-128 test-only known reader/owner passwords; unsupported input");
    if (runtime.callMain(["--static-id", "--static-aes-iv", "--encrypt", "", "owner", "128", "--use-aes=y", "--", "/input.pdf", "/empty-password.pdf"]) !== 0) throw new Error("Empty-user encrypted fixture generation failed");
    await save("empty-password-encrypted.pdf", runtime.FS.readFile("/empty-password.pdf"), "encrypted with empty user password; still unsupported");
    if (runtime.callMain(["--deterministic-id", "/input.pdf", "/optimized.pdf"]) !== 0) throw new Error("Optimized fixture generation failed");
    await save("already-optimized.pdf", runtime.FS.readFile("/optimized.pdf"), "structurally rewritten fixture");
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(identity, null, 2)}\n`);
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Fixture generation failed"}\n`); process.exitCode = 1; });
