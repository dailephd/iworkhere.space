import type { FieldErrorCode, FieldErrorMap, NormalizedReport, ParsedReport, ReportArea, ReportCategory } from "./contract";
import { REPORT_CATEGORY, SUPPORT_LIMIT, SUPPORT_SCHEMA_VERSION } from "./contract";
import { isAllowedPathname, type SupportContextSource } from "./context";
import { categoryRule } from "./taxonomy";

const REQUIRED_KEY = ["schemaVersion", "category", "area", "pathname", "description", "contactConsent", "idempotencyKey", "turnstileToken"] as const;
const OPTIONAL_KEY = ["toolId", "expected", "observed", "email"] as const;
const AREA: readonly ReportArea[] = ["tool", "site-wide", "other"];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control characters other than newline and tab are never stored; PostgreSQL also rejects NUL.
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Code-point length: an astral character counts as one. */
export function codePointLength(value: string): number {
    return Array.from(value).length;
}

/** Normalizes a free-text field; returns the value or the failing code. */
export function normalizeText(value: unknown, max: number): { value: string } | { code: FieldErrorCode } {
    if (typeof value !== "string") return { code: "invalid" };
    const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    if (typeof text.isWellFormed === "function" && !text.isWellFormed()) return { code: "invalid" };
    if (CONTROL_CHARACTER.test(text)) return { code: "invalid" };
    if (codePointLength(text) > max) return { code: "too_long" };
    return { value: text };
}

function optionalText(input: Record<string, unknown>, key: "expected" | "observed", max: number, error: FieldErrorMap): string | null {
    if (input[key] === undefined || input[key] === null) return null;
    const result = normalizeText(input[key], max);
    if ("code" in result) { error[key] = result.code; return null; }
    return result.value === "" ? null : result.value;
}

/** Exact-field, versioned validation. The Turnstile token is returned separately and is never part of the report. */
export function parseReportRequest(input: unknown, source: SupportContextSource): ParsedReport {
    if (!record(input)) return { ok: false, fieldError: { request: "invalid" } };
    const error: FieldErrorMap = {};
    const allowed = new Set<string>([...REQUIRED_KEY, ...OPTIONAL_KEY]);
    for (const key of Object.keys(input)) if (!allowed.has(key)) error[key] = "unknown_field";
    for (const key of REQUIRED_KEY) if (input[key] === undefined) error[key] = "required";
    // An unselected form control arrives as an empty string and means "not chosen yet".
    if (input.category === "") error.category = "required";
    if (input.area === "") error.area = "required";

    if (input.schemaVersion !== undefined && input.schemaVersion !== SUPPORT_SCHEMA_VERSION) error.schemaVersion = "invalid";
    const category = (REPORT_CATEGORY as readonly unknown[]).includes(input.category) ? (input.category as ReportCategory) : null;
    if (input.category !== undefined && input.category !== "" && !category) error.category = "invalid";
    const area = (AREA as readonly unknown[]).includes(input.area) ? (input.area as ReportArea) : null;
    if (input.area !== undefined && input.area !== "" && !area) error.area = "invalid";

    let toolId: string | null = null;
    if (area === "tool") {
        if (typeof input.toolId !== "string" || !source.tool.some(item => item.id === input.toolId)) error.toolId = input.toolId === undefined ? "required" : "invalid";
        else toolId = input.toolId;
    } else if (area && input.toolId !== undefined && input.toolId !== null) error.toolId = "invalid";

    let pathname = "/";
    if (input.pathname !== undefined) {
        if (typeof input.pathname !== "string" || !isAllowedPathname(input.pathname, source)) error.pathname = "invalid";
        else pathname = input.pathname;
    }

    let description = "";
    if (input.description !== undefined) {
        const result = normalizeText(input.description, SUPPORT_LIMIT.description);
        if ("code" in result) error.description = result.code;
        else if (result.value === "") error.description = "required";
        else description = result.value;
    }
    const expected = optionalText(input, "expected", SUPPORT_LIMIT.expected, error);
    const observed = optionalText(input, "observed", SUPPORT_LIMIT.observed, error);
    if (category && categoryRule(category).expectedRequired && expected === null && !error.expected) error.expected = "required";

    if (input.contactConsent !== undefined && typeof input.contactConsent !== "boolean") error.contactConsent = "invalid";
    const contactConsent = input.contactConsent === true;
    let email: string | null = null;
    if (input.email !== undefined && input.email !== null && input.email !== "") {
        // Without consent the address is discarded and never validated, stored or used.
        if (contactConsent) {
            const result = normalizeText(input.email, SUPPORT_LIMIT.email);
            if ("code" in result) error.email = result.code;
            else if (!EMAIL.test(result.value) || result.value.includes("\n")) error.email = "invalid";
            else email = result.value.toLowerCase();
        }
    } else if (contactConsent) error.email = "required";

    if (input.idempotencyKey !== undefined && (typeof input.idempotencyKey !== "string" || !UUID_V4.test(input.idempotencyKey))) error.idempotencyKey = "invalid";
    let turnstileToken = "";
    if (input.turnstileToken !== undefined) {
        if (typeof input.turnstileToken !== "string" || input.turnstileToken.length === 0) error.turnstileToken = "required";
        else if (input.turnstileToken.length > SUPPORT_LIMIT.token) error.turnstileToken = "too_long";
        else turnstileToken = input.turnstileToken;
    }

    if (Object.keys(error).length > 0 || !category || !area) return { ok: false, fieldError: error };
    const report: NormalizedReport = { category, area, toolId, pathname, description, expected, observed, email, contactConsent };
    return { ok: true, report, idempotencyKey: input.idempotencyKey as string, turnstileToken };
}
