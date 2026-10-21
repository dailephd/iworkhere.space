import "server-only";
import { ContactPayloadTooLargeError, readContactJson } from "./body";
import { parseContactRequest, type ContactField, type ContactRequest } from "./contract";
import { sameOriginContactRequest } from "./origin";
import { sendContactEmail, type SendContactEmailResult } from "./sendContactEmail.server";

export interface ContactDependency {
    send(payload: ContactRequest): Promise<SendContactEmailResult>;
}

export type ContactErrorCode = "forbidden" | "invalid_request" | "invalid_field" | "too_large" | "unavailable" | "delivery_failed";

export type ContactResponseBody =
    | { ok: true }
    | { ok: false; error: ContactErrorCode; field?: ContactField };

const STATUS: Record<ContactErrorCode, number> = {
    forbidden: 403,
    invalid_request: 400,
    invalid_field: 400,
    too_large: 413,
    unavailable: 503,
    delivery_failed: 502,
};

function respond(body: ContactResponseBody, status: number): Response {
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(error: ContactErrorCode, field?: ContactField): Response {
    return respond({ ok: false, error, ...(field ? { field } : {}) }, STATUS[error]);
}

export function defaultContactDependency(): ContactDependency {
    return { send: payload => sendContactEmail(payload) };
}

/** The whole contact pipeline: origin, bounded read, strict parse, honeypot, delivery. */
export async function handleContactRequest(request: Request, dependency: ContactDependency = defaultContactDependency()): Promise<Response> {
    if (!sameOriginContactRequest(request)) return fail("forbidden");

    let body: unknown;
    try {
        body = await readContactJson(request);
    } catch (error) {
        if (error instanceof ContactPayloadTooLargeError) return fail("too_large");
        return fail("invalid_request");
    }

    const parsed = parseContactRequest(body);
    if (parsed.kind === "invalid_request") return fail("invalid_request");
    if (parsed.kind === "invalid_field") return fail("invalid_field", parsed.field);
    // Success-shaped on purpose, so automation gets no signal to retry or adapt. Nothing is sent.
    if (parsed.kind === "honeypot") return respond({ ok: true }, 200);

    let result: SendContactEmailResult;
    try {
        result = await dependency.send(parsed.value);
    } catch {
        return fail("delivery_failed");
    }
    if (result.ok) return respond({ ok: true }, 200);
    return fail(result.reason === "not_configured" ? "unavailable" : "delivery_failed");
}
