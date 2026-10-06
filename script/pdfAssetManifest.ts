import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
export interface PdfAsset { path: string; bytes: number; sha256: string; purpose: string; upstream: string; notice: string }
export interface PdfAssetManifest { version: string; asset: PdfAsset[] }
export function readPdfAssetManifest(value: unknown): PdfAssetManifest {
    if (!value || typeof value !== "object" || !("version" in value) || typeof value.version !== "string" || !("asset" in value) || !Array.isArray(value.asset) || value.asset.length === 0) throw new Error("Invalid PDF asset manifest");
    const seen = new Set<string>();
    const asset = value.asset.map((entry: unknown): PdfAsset => {
        if (!entry || typeof entry !== "object") throw new Error("Invalid PDF asset entry");
        const item = entry as PdfAsset;
        if (typeof item.path !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(item.path) || item.path.startsWith("/") || item.path.split("/").includes("..") || seen.has(item.path) || !Number.isSafeInteger(item.bytes) || item.bytes <= 0 || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || typeof item.purpose !== "string" || !item.purpose || typeof item.upstream !== "string" || !item.upstream || typeof item.notice !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(item.notice) || !item.notice.startsWith("public/licenses/") || item.notice.split("/").includes("..")) throw new Error("Invalid PDF asset identity");
        seen.add(item.path); return item;
    });
    return { version: value.version, asset };
}
export async function verifyPdfAssetManifest(root: string, manifest: PdfAssetManifest): Promise<void> {
    for (const item of manifest.asset) {
        const data = await readFile(path.join(root, item.path));
        if (data.length !== item.bytes || createHash("sha256").update(data).digest("hex") !== item.sha256) throw new Error(`PDF asset identity mismatch: ${item.path}`);
        const notice = await readFile(item.notice);
        if (notice.length === 0) throw new Error(`Missing PDF notice: ${item.notice}`);
    }
}
