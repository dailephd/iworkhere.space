import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

    it("holds only the publisher identity and the Contact copy", () => {
        expect(Object.keys(site).sort()).toEqual(["contact", "publisher"]);
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
    });

    it("returns independent copies so a caller cannot change the shared source", () => {
        const first = getSiteInformation();
        first.publisher.legalName = "changed";
        expect(getSiteInformation().publisher.legalName).toBe("dailephd LLC");
    });
});
