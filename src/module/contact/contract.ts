export const CONTACT_LIMIT = {
    bodyBytes: 64 * 1024,
    emailLength: 254,
    titleLength: 200,
    messageMin: 10,
    messageMax: 10_000,
} as const;

/** Fields a visitor authors. The honeypot is a transport field and is never part of a valid request. */
export const CONTACT_FIELD = ["senderEmail", "title", "message"] as const;
export type ContactField = (typeof CONTACT_FIELD)[number];

/** Every key the endpoint accepts; anything else is rejected. */
export const CONTACT_ACCEPTED_KEY = [...CONTACT_FIELD, "companyWebsite"] as const;

export interface ContactRequest {
    senderEmail: string;
    title: string;
    message: string;
}

export type ContactProblem = "required" | "invalid" | "too_short" | "too_long";
export type ContactProblemMap = Partial<Record<ContactField, ContactProblem>>;

export type ContactFieldResult =
    | { ok: true; value: ContactRequest }
    | { ok: false; problem: ContactProblemMap };

export type ContactParseResult =
    | { kind: "valid"; value: ContactRequest }
    | { kind: "honeypot" }
    | { kind: "invalid_request" }
    | { kind: "invalid_field"; field: ContactField; problem: ContactProblem };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_ANY = /[\u0000-\u001f\u007f]/;
// Tab, line feed and carriage return are ordinary in a message body.
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Trims and validates the three visitor fields. Shared by the browser form and the server so both apply the same rules. */
export function validateContactFields(input: ContactRequest): ContactFieldResult {
    const senderEmail = input.senderEmail.trim();
    const title = input.title.trim();
    const message = input.message.trim();
    const problem: ContactProblemMap = {};

    if (!senderEmail) problem.senderEmail = "required";
    else if (senderEmail.length > CONTACT_LIMIT.emailLength || !EMAIL_PATTERN.test(senderEmail) || CONTROL_ANY.test(senderEmail)) problem.senderEmail = "invalid";

    if (!title) problem.title = "required";
    else if (title.length > CONTACT_LIMIT.titleLength) problem.title = "too_long";
    else if (CONTROL_ANY.test(title)) problem.title = "invalid";

    if (!message) problem.message = "required";
    else if (message.length < CONTACT_LIMIT.messageMin) problem.message = "too_short";
    else if (message.length > CONTACT_LIMIT.messageMax) problem.message = "too_long";
    else if (CONTROL_EXCEPT_WHITESPACE.test(message)) problem.message = "invalid";

    if (Object.keys(problem).length > 0) return { ok: false, problem };
    return { ok: true, value: { senderEmail, title, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strict server-side parse of a decoded JSON body. */
export function parseContactRequest(body: unknown): ContactParseResult {
    if (!isPlainObject(body)) return { kind: "invalid_request" };
    const accepted: readonly string[] = CONTACT_ACCEPTED_KEY;
    if (Object.keys(body).some(key => !accepted.includes(key))) return { kind: "invalid_request" };

    const text: Record<string, string> = { senderEmail: "", title: "", message: "", companyWebsite: "" };
    for (const key of CONTACT_ACCEPTED_KEY) {
        const value = body[key];
        if (value === undefined) continue;
        if (typeof value !== "string") return { kind: "invalid_request" };
        text[key] = value;
    }

    // A filled honeypot is a bot: the caller answers as if the message had been accepted and sends nothing.
    if (text.companyWebsite.trim() !== "") return { kind: "honeypot" };

    const checked = validateContactFields({ senderEmail: text.senderEmail, title: text.title, message: text.message });
    if (checked.ok) return { kind: "valid", value: checked.value };
    const field = CONTACT_FIELD.find(name => checked.problem[name]);
    return { kind: "invalid_field", field: field!, problem: checked.problem[field!]! };
}
