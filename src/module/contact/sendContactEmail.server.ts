import "server-only";
import { Resend } from "resend";
import type { ContactRequest } from "./contract";

export interface ContactEmailConfig {
    apiKey: string | undefined;
    /** Operator inbox. Server-only and never given a default address. */
    to: string | undefined;
    /** Address on a sender domain verified in Resend. */
    from: string | undefined;
    fromName: string;
    subjectPrefix: string;
}

export interface ContactEmailMessage {
    from: string;
    to: string[];
    replyTo: string;
    subject: string;
    text: string;
    html: string;
}

/** The part of the Resend client this module uses; `new Resend(key)` satisfies it. */
export interface ContactEmailClient {
    emails: { send(message: ContactEmailMessage): Promise<{ error: unknown }> };
}

export type SendContactEmailResult =
    | { ok: true }
    | { ok: false; reason: "not_configured" | "provider_error" };

export interface SendContactEmailOptions {
    config?: ContactEmailConfig;
    createClient?: (apiKey: string) => ContactEmailClient;
    now?: () => Date;
    timeoutMs?: number;
}

const SOURCE = "iworkhere.space contact form";
const DEFAULT_FROM_NAME = "iworkhere.space";
const DEFAULT_SUBJECT_PREFIX = "[iworkhere.space contact]";
const DEFAULT_TIMEOUT_MS = 15_000;

function setting(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function defaultContactEmailConfig(env: Record<string, string | undefined> = process.env): ContactEmailConfig {
    return {
        apiKey: setting(env.RESEND_API_KEY),
        to: setting(env.CONTACT_TO_EMAIL),
        from: setting(env.CONTACT_FROM_EMAIL),
        fromName: setting(env.CONTACT_FROM_NAME) ?? DEFAULT_FROM_NAME,
        subjectPrefix: setting(env.CONTACT_SUBJECT_PREFIX) ?? DEFAULT_SUBJECT_PREFIX,
    };
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function buildContactEmail(payload: ContactRequest, config: { from: string; to: string; fromName: string; subjectPrefix: string }, sentAt: Date): ContactEmailMessage {
    const timestamp = sentAt.toISOString();
    const text = [
        `From: ${payload.senderEmail}`,
        `Subject: ${payload.title}`,
        `Sent: ${timestamp}`,
        `Source: ${SOURCE}`,
        "",
        payload.message,
    ].join("\n");
    const html = [
        `<p><strong>From:</strong> ${escapeHtml(payload.senderEmail)}</p>`,
        `<p><strong>Subject:</strong> ${escapeHtml(payload.title)}</p>`,
        `<p><strong>Sent:</strong> ${escapeHtml(timestamp)}</p>`,
        `<p><strong>Source:</strong> ${escapeHtml(SOURCE)}</p>`,
        "<hr />",
        `<p style="white-space:pre-wrap">${escapeHtml(payload.message)}</p>`,
    ].join("\n");
    return {
        from: `${config.fromName} <${config.from}>`,
        to: [config.to],
        replyTo: payload.senderEmail,
        subject: `${config.subjectPrefix} ${payload.title}`,
        text,
        html,
    };
}

function timeoutAfter(milliseconds: number): { promise: Promise<never>; cancel: () => void } {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<never>((_, reject) => { handle = setTimeout(() => reject(new Error("timeout")), milliseconds); });
    return { promise, cancel: () => clearTimeout(handle) };
}

/**
 * Sends one visitor message to the operator inbox through the Resend SDK. It reports only a coarse reason on failure and
 * never logs or returns visitor content, provider response bodies or configuration values.
 */
export async function sendContactEmail(payload: ContactRequest, options: SendContactEmailOptions = {}): Promise<SendContactEmailResult> {
    const config = options.config ?? defaultContactEmailConfig();
    if (!config.apiKey || !config.from || !config.to) return { ok: false, reason: "not_configured" };

    const createClient = options.createClient ?? ((apiKey: string) => new Resend(apiKey));
    const message = buildContactEmail(payload, { from: config.from, to: config.to, fromName: config.fromName, subjectPrefix: config.subjectPrefix }, (options.now ?? (() => new Date()))());
    const timeout = timeoutAfter(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
        const result = await Promise.race([createClient(config.apiKey).emails.send(message), timeout.promise]);
        return result.error ? { ok: false, reason: "provider_error" } : { ok: true };
    } catch {
        return { ok: false, reason: "provider_error" };
    } finally {
        timeout.cancel();
    }
}
