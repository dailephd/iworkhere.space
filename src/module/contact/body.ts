import { CONTACT_LIMIT } from "./contract";

export class ContactPayloadTooLargeError extends Error {
    constructor() { super("Contact request body exceeds the size limit"); }
}
export class ContactMalformedBodyError extends Error {
    constructor() { super("Contact request body is not valid JSON"); }
}

/** Reads a JSON body without ever buffering more than `maximumBytes`. */
export async function readContactJson(request: Request, maximumBytes: number = CONTACT_LIMIT.bodyBytes): Promise<unknown> {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new ContactMalformedBodyError();
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maximumBytes) throw new ContactPayloadTooLargeError();
    if (!request.body) throw new ContactMalformedBodyError();
    const reader = request.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    let text = "";
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maximumBytes) { await reader.cancel(); throw new ContactPayloadTooLargeError(); }
            text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
    } catch (error) {
        if (error instanceof ContactPayloadTooLargeError) throw error;
        throw new ContactMalformedBodyError();
    } finally { reader.releaseLock(); }
    try { return JSON.parse(text); } catch { throw new ContactMalformedBodyError(); }
}
