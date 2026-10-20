import { SUPPORT_LIMIT } from "./contract";

export class PayloadTooLargeError extends Error {
    constructor() { super("Support request body exceeds the size limit"); }
}
export class MalformedBodyError extends Error {
    constructor() { super("Support request body is not valid JSON"); }
}

/** Reads a JSON body without ever buffering more than `maximumBytes`. */
export async function readBoundedJson(request: Request, maximumBytes: number = SUPPORT_LIMIT.bodyBytes): Promise<unknown> {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new MalformedBodyError();
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maximumBytes) throw new PayloadTooLargeError();
    if (!request.body) throw new MalformedBodyError();
    const reader = request.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    let text = "";
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maximumBytes) { await reader.cancel(); throw new PayloadTooLargeError(); }
            text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
    } catch (error) {
        if (error instanceof PayloadTooLargeError) throw error;
        throw new MalformedBodyError();
    } finally { reader.releaseLock(); }
    try { return JSON.parse(text); } catch { throw new MalformedBodyError(); }
}
