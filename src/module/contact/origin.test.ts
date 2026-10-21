import { describe, expect, it } from "vitest";
import { sameOriginContactRequest } from "./origin";

const request = (headers: Record<string, string>) => new Request("https://iworkhere.space/api/contact", { method: "POST", headers });

describe("sameOriginContactRequest", () => {
    it("accepts an Origin whose host matches the Host header", () => {
        expect(sameOriginContactRequest(request({ origin: "https://iworkhere.space", host: "iworkhere.space" }))).toBe(true);
        expect(sameOriginContactRequest(request({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", "sec-fetch-site": "same-origin" }))).toBe(true);
    });

    it("prefers the forwarded host behind a proxy", () => {
        expect(sameOriginContactRequest(request({ origin: "https://iworkhere.space", host: "internal:3000", "x-forwarded-host": "iworkhere.space, proxy" }))).toBe(true);
        expect(sameOriginContactRequest(request({ origin: "https://iworkhere.space", host: "iworkhere.space", "x-forwarded-host": "evil.example" }))).toBe(false);
    });

    it("rejects a missing Origin, unlike the report endpoint", () => {
        expect(sameOriginContactRequest(request({ host: "iworkhere.space" }))).toBe(false);
    });

    it("rejects a foreign, null or malformed Origin", () => {
        expect(sameOriginContactRequest(request({ origin: "https://evil.example", host: "iworkhere.space" }))).toBe(false);
        expect(sameOriginContactRequest(request({ origin: "null", host: "iworkhere.space" }))).toBe(false);
        expect(sameOriginContactRequest(request({ origin: "not a url", host: "iworkhere.space" }))).toBe(false);
        expect(sameOriginContactRequest(request({ origin: "https://iworkhere.space.evil.example", host: "iworkhere.space" }))).toBe(false);
    });

    it("rejects cross-site fetch metadata even when the Origin matches", () => {
        for (const site of ["cross-site", "same-site", "none"]) {
            expect(sameOriginContactRequest(request({ origin: "https://iworkhere.space", host: "iworkhere.space", "sec-fetch-site": site })), site).toBe(false);
        }
    });
});
