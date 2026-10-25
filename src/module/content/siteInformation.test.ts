import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";
import { getSiteInformation } from "./siteInformation";

const everyString = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(everyString);
    if (typeof value === "object" && value !== null) return Object.values(value).flatMap(everyString);
    return [];
};

describe("site information", () => {
    const site = getSiteInformation();

    it("names the publisher and product exactly as the footer identity does", () => {
        expect(site.publisher).toEqual({ legalName: "dailephd LLC", productName: "iworkhere.space" });
        const footer = readFileSync(path.resolve(__dirname, "../../component/layout/Footer.tsx"), "utf8");
        expect(footer).toContain(`© 2026 ${site.publisher.productName} created by ${site.publisher.legalName}`);
    });

    it("derives tool and category counts from the registry instead of typing them", () => {
        expect(site.toolCount).toBe(getAllTool().length);
        expect(site.categoryCount).toBe(getAvailableCategory().length);
    });

    it("describes every documented tool group once with unique ids", () => {
        expect(site.capability.map(item => item.id)).toEqual(["pdf", "image", "text", "calculation", "developer"]);
        expect(new Set(site.capability.map(item => item.id)).size).toBe(site.capability.length);
        for (const item of site.capability) expect(item.body.length).toBeGreaterThan(20);
    });

    it("grounds its capability words in tools that exist in the registry", () => {
        const names = getAllTool().map(tool => tool.name);
        for (const expected of ["Merge PDF", "Split PDF", "Compress PDF", "Images to PDF", "Image Resizer", "Image Compressor", "Slugify Text", "Calculator", "JSON Formatter / Validator", "QR Code Generator"]) expect(names, expected).toContain(expected);
        const prose = site.capability.map(item => item.body).join(" ");
        for (const word of ["Merge", "split", "compress", "Resize", "slugs", "JSON", "QR codes"]) expect(prose).toContain(word);
    });

    it("lists only published releases, newest first, from the changelog", () => {
        const changelog = readFileSync(path.resolve(__dirname, "../../../CHANGELOG.md"), "utf8");
        for (const release of site.release) expect(changelog, release.version).toContain(`## ${release.version} — ${release.title} — ${release.date}`);
        const dates = site.release.map(item => item.date);
        expect([...dates].sort().reverse()).toEqual(dates);
        expect(site.release.map(item => item.version)).not.toContain("v0.4.3");
        expect(everyString(site.release).join(" ")).not.toMatch(/v0\.[5-9]/);
    });

    it("keeps the Contact and Report Issues distinction and never exposes an address", () => {
        expect(site.contact.purpose).toContain("Resend");
        expect(site.contact.reportDistinction).toContain("Report Issues");
        expect(site.contact.reportDistinction).toContain("separate system");
        expect(everyString(site).join("\n")).not.toContain("@");
        expect(everyString(site).join("\n")).not.toMatch(/https?:\/\//);
    });

    it("makes no invented claim about people, places, numbers, certification or reply times", () => {
        const text = everyString(site).join("\n");
        for (const pattern of [
            /\bfounder\b/i, /\bbiograph/i, /\bour team\b/i, /\bteam of\b/i, /\bengineers?\b/i, /\bstaff\b/i, /\bcertified\b/i, /\bISO\b/, /\bSOC ?2\b/i,
            /testimonial/i, /\bcustomers?\b/i, /\busers? (love|trust)/i, /\bmillions?\b/i, /\bdaily\b/i, /\bevery (day|week)\b/i, /\b24\/7\b/, /within \d+ (hours?|days?)/i,
            /\+\d|\(\d{3}\)|\b\d{3}[ .-]\d{3}[ .-]\d{4}\b/, /\b(street|avenue|suite|po box)\b/i, /guarantee[sd]? (a |the )?(reply|response)/i,
        ]) expect(text, String(pattern)).not.toMatch(pattern);
        expect(text).toContain("do not promise a reply by a particular time");
    });

    it("returns independent copies so a caller cannot change the shared source", () => {
        const first = getSiteInformation();
        first.capability.pop();
        first.publisher.legalName = "changed";
        expect(getSiteInformation().capability).toHaveLength(5);
        expect(getSiteInformation().publisher.legalName).toBe("dailephd LLC");
    });
});

describe("capability claims", () => {
    it("describes Time Arithmetic as hours-and-minutes durations, not dates or time zones", () => {
        const text = getSiteInformation().capability.map(item => item.body).join(" ")
        expect(text).toContain("durations written as hours and minutes")
        expect(text).not.toMatch(/dates? and times?|calendar|time ?zone/i)
    })
})
