import { describe, expect, it } from "vitest";
import { ContactMalformedBodyError, ContactPayloadTooLargeError, readContactJson } from "./body";
import { CONTACT_LIMIT } from "./contract";

const post = (body: BodyInit | null, headers: Record<string, string> = { "Content-Type": "application/json" }) =>
    new Request("https://iworkhere.space/api/contact", { method: "POST", headers, body });

function streamOf(chunk: Uint8Array, count: number, pulled: { count: number }): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            pulled.count += 1;
            if (pulled.count > count) { controller.close(); return; }
            controller.enqueue(chunk);
        },
    });
}

describe("readContactJson", () => {
    it("has a 64 KiB cap that is separate from the report intake cap", () => {
        expect(CONTACT_LIMIT.bodyBytes).toBe(65536);
    });

    it("parses a JSON body, including multi-byte text", async () => {
        expect(await readContactJson(post(JSON.stringify({ title: "Grüße 日本" })))).toEqual({ title: "Grüße 日本" });
        expect(await readContactJson(post("{}", { "Content-Type": "application/json; charset=utf-8" }))).toEqual({});
    });

    it.each([
        ["no content type", {}],
        ["text/plain", { "Content-Type": "text/plain" }],
        ["a form post", { "Content-Type": "application/x-www-form-urlencoded" }],
    ])("rejects %s", async (_name, headers) => {
        await expect(readContactJson(post("{}", headers))).rejects.toBeInstanceOf(ContactMalformedBodyError);
    });

    it("rejects malformed JSON, an empty body, a missing body and invalid UTF-8", async () => {
        await expect(readContactJson(post("{not json"))).rejects.toBeInstanceOf(ContactMalformedBodyError);
        await expect(readContactJson(post(""))).rejects.toBeInstanceOf(ContactMalformedBodyError);
        await expect(readContactJson(post(null))).rejects.toBeInstanceOf(ContactMalformedBodyError);
        await expect(readContactJson(post(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])))).rejects.toBeInstanceOf(ContactMalformedBodyError);
    });

    it("rejects a declared length over the cap before reading anything", async () => {
        const request = post("{}", { "Content-Type": "application/json", "Content-Length": String(CONTACT_LIMIT.bodyBytes + 1) });
        await expect(readContactJson(request)).rejects.toBeInstanceOf(ContactPayloadTooLargeError);
    });

    it("stops reading a streamed body as soon as the cap is crossed, without trusting any declared length", async () => {
        const pulled = { count: 0 };
        const chunk = new TextEncoder().encode(`"${"a".repeat(8191)}"`);
        const request = new Request("https://iworkhere.space/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: streamOf(chunk, 1000, pulled),
            duplex: "half",
        } as RequestInit);
        await expect(readContactJson(request)).rejects.toBeInstanceOf(ContactPayloadTooLargeError);
        // 64 KiB / 8 KiB chunks: the ninth chunk crosses the cap. A reader that buffered everything would pull all 1000.
        expect(pulled.count).toBeLessThan(20);
    });

    it("accepts a body exactly at the cap", async () => {
        const filler = "a".repeat(CONTACT_LIMIT.bodyBytes - 2);
        expect(await readContactJson(post(`"${filler}"`))).toBe(filler);
    });
});
