import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
interface PdfFixtureIdentity { name: string; bytes: number; sha256: string; purpose: string }
it("retains the complete deterministic corpus and its byte identities", async () => {
    const manifest = JSON.parse(await readFile("test/fixtures/pdf/manifest.json", "utf8")) as PdfFixtureIdentity[];
    expect(manifest.map(item => item.name)).toEqual(expect.arrayContaining(["text-vector.pdf", "jpeg-heavy.pdf", "png-heavy.pdf", "mixed.pdf", "rotated.pdf", "mixed-dimensions.pdf", "ordering.pdf", "multipage.pdf", "already-optimized.pdf", "encrypted.pdf", "empty-password-encrypted.pdf", "truncated.pdf", "invalid-body.pdf", "false-signature.pdf", "damaged-xref.pdf", "large-page-box.pdf", "page-limit.pdf", "standard-fonts.pdf"]));
    expect(new Set(manifest.map(item => item.name)).size).toBe(manifest.length);
    for (const item of manifest) {
        expect(item.name).toMatch(/^[a-z-]+\.pdf$/); expect(item.purpose.length).toBeGreaterThan(0);
        const bytes = await readFile(`test/fixtures/pdf/${item.name}`);
        expect(bytes.length).toBe(item.bytes); expect(createHash("sha256").update(bytes).digest("hex")).toBe(item.sha256);
    }
});
