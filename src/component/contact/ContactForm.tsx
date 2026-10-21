"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CONTACT_FIELD, CONTACT_LIMIT, validateContactFields, type ContactField, type ContactProblem } from "@/module/contact/contract";

type FormStatus = "idle" | "sending" | "success" | "error";
type FieldMessage = Partial<Record<ContactField, string>>;

interface ContactDraft {
    senderEmail: string;
    title: string;
    message: string;
    /** Honeypot: hidden from people, filled by naive automation, and always posted so the server can see it. */
    companyWebsite: string;
}

const EMPTY_DRAFT: ContactDraft = { senderEmail: "", title: "", message: "", companyWebsite: "" };

const CONTROL = "block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2 text-text read-only:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";
const BUTTON_PRIMARY = "material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";
const BUTTON_SECONDARY = "min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2 text-text disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const PROBLEM_MESSAGE: Record<ContactField, Partial<Record<ContactProblem, string>>> = {
    senderEmail: { required: "Enter your email address.", invalid: "Enter a valid email address." },
    title: { required: "Enter a title.", too_long: `Use ${CONTACT_LIMIT.titleLength} characters or fewer.`, invalid: "The title contains characters that are not allowed." },
    message: {
        required: "Enter a message.",
        too_short: `Write at least ${CONTACT_LIMIT.messageMin} characters.`,
        too_long: `Use ${CONTACT_LIMIT.messageMax.toLocaleString("en-US")} characters or fewer.`,
        invalid: "The message contains characters that are not allowed.",
    },
};

const FIELD_ID: Record<ContactField, string> = { senderEmail: "senderEmail", title: "title", message: "message" };

const SUCCESS_MESSAGE = "Thank you. Your message was submitted for delivery to the site operator. We do not promise a reply by a particular time.";
const SENDING_MESSAGE = "Sending your message…";
const VALIDATION_MESSAGE = "Some details need attention. Your text has been kept.";
const NETWORK_MESSAGE = "We could not reach the server. Your message has not been sent. Check your connection and try again.";

/** Fixed copy for each server outcome; provider and configuration detail never reaches the page. */
function messageForFailure(status: number, code: unknown): string {
    if (status === 403 || code === "forbidden") return "This message could not be sent from this page. Reload the page and try again. Your text has been kept.";
    if (status === 413 || code === "too_large") return "Your message is too large. Shorten it and try again. Your text has been kept.";
    if (status === 503 || code === "unavailable") return "Contact is temporarily unavailable. Your message has not been sent, and your text has been kept. Please try again later.";
    if (status === 400) return VALIDATION_MESSAGE;
    return "Something went wrong and your message may not have been sent. Your text has been kept. Please try again later.";
}

function isContactField(value: unknown): value is ContactField {
    return typeof value === "string" && (CONTACT_FIELD as readonly string[]).includes(value);
}

export function ContactForm() {
    const id = useId();
    const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
    const [status, setStatus] = useState<FormStatus>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [fieldMessage, setFieldMessage] = useState<FieldMessage>({});
    // State updates are asynchronous, so a second submit in the same tick is stopped by this synchronous guard.
    const inFlight = useRef(false);
    const submitButton = useRef<HTMLButtonElement>(null);
    const sending = status === "sending";

    function fieldId(field: ContactField): string {
        return `${id}-${FIELD_ID[field]}`;
    }

    function change(field: keyof ContactDraft) {
        return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(current => ({ ...current, [field]: event.target.value }));
    }

    function focusField(field: ContactField) {
        document.getElementById(fieldId(field))?.focus();
    }

    function fail(message: string, fields: FieldMessage = {}) {
        setErrorMessage(message);
        setFieldMessage(fields);
        setStatus("error");
        const first = CONTACT_FIELD.find(field => fields[field]);
        if (first) focusField(first);
    }

    function clear() {
        setDraft(EMPTY_DRAFT);
        setStatus("idle");
        setErrorMessage("");
        setFieldMessage({});
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current) return;

        const checked = validateContactFields(draft);
        if (!checked.ok) {
            const fields: FieldMessage = {};
            for (const field of CONTACT_FIELD) {
                const problem = checked.problem[field];
                if (problem) fields[field] = PROBLEM_MESSAGE[field][problem];
            }
            fail(VALIDATION_MESSAGE, fields);
            return;
        }

        inFlight.current = true;
        setStatus("sending");
        setErrorMessage("");
        setFieldMessage({});
        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...checked.value, companyWebsite: draft.companyWebsite }),
            });
            const body: unknown = await response.json().catch(() => null);
            const result = typeof body === "object" && body !== null ? body as { ok?: unknown; error?: unknown; field?: unknown } : {};
            if (response.status === 200 && result.ok === true) {
                setDraft(EMPTY_DRAFT);
                setStatus("success");
            } else if (response.status === 400 && result.error === "invalid_field" && isContactField(result.field)) {
                fail(VALIDATION_MESSAGE, { [result.field]: "This value is not valid." });
            } else {
                fail(messageForFailure(response.status, result.error));
            }
        } catch {
            fail(NETWORK_MESSAGE);
        } finally {
            inFlight.current = false;
            // A disabled submit button drops focus; hand it back so a keyboard user can continue or retry.
            requestAnimationFrame(() => { if (document.activeElement === document.body) submitButton.current?.focus(); });
        }
    }

    function describedBy(field: ContactField): string | undefined {
        return fieldMessage[field] ? `${fieldId(field)}-error` : undefined;
    }

    return (
        <form
            method="post"
            action="/api/contact"
            onSubmit={submit}
            noValidate
            aria-label="Contact form"
            aria-busy={sending}
            className="space-y-4"
        >
            <div hidden aria-hidden="true">
                <label htmlFor={`${id}-company`}>Company website (leave blank)</label>
                <input id={`${id}-company`} type="text" tabIndex={-1} autoComplete="off" value={draft.companyWebsite} onChange={change("companyWebsite")} />
            </div>

            <div className="space-y-1">
                <label htmlFor={fieldId("senderEmail")} className="block text-sm font-medium">Your email <span aria-hidden="true">*</span></label>
                <input id={fieldId("senderEmail")} type="email" autoComplete="email" required readOnly={sending} value={draft.senderEmail} onChange={change("senderEmail")}
                    maxLength={CONTACT_LIMIT.emailLength} aria-invalid={fieldMessage.senderEmail ? true : undefined} aria-describedby={describedBy("senderEmail")} className={CONTROL} />
                {fieldMessage.senderEmail ? <p id={`${fieldId("senderEmail")}-error`} className="text-sm text-danger">{fieldMessage.senderEmail}</p> : null}
            </div>

            <div className="space-y-1">
                <label htmlFor={fieldId("title")} className="block text-sm font-medium">Title <span aria-hidden="true">*</span></label>
                <input id={fieldId("title")} type="text" required readOnly={sending} value={draft.title} onChange={change("title")}
                    maxLength={CONTACT_LIMIT.titleLength} aria-invalid={fieldMessage.title ? true : undefined} aria-describedby={describedBy("title")} className={CONTROL} />
                {fieldMessage.title ? <p id={`${fieldId("title")}-error`} className="text-sm text-danger">{fieldMessage.title}</p> : null}
            </div>

            <div className="space-y-1">
                <label htmlFor={fieldId("message")} className="block text-sm font-medium">Message <span aria-hidden="true">*</span></label>
                <textarea id={fieldId("message")} rows={7} required readOnly={sending} value={draft.message} onChange={change("message")}
                    maxLength={CONTACT_LIMIT.messageMax} aria-invalid={fieldMessage.message ? true : undefined} aria-describedby={describedBy("message")} className={`${CONTROL} min-h-40 resize-y`} />
                {fieldMessage.message ? <p id={`${fieldId("message")}-error`} className="text-sm text-danger">{fieldMessage.message}</p> : null}
            </div>

            {/* Live regions stay mounted so assistive technology announces their text when it changes. */}
            <div role="status" aria-live="polite">
                {sending ? <p className="rounded-lg border border-border bg-surface-alt p-3 text-sm">{SENDING_MESSAGE}</p> : null}
                {status === "success" ? <p className="rounded-lg border border-border bg-surface-alt p-3 text-sm">{SUCCESS_MESSAGE}</p> : null}
            </div>
            <div role="alert">
                {status === "error" && errorMessage ? <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm">{errorMessage}</p> : null}
            </div>

            <div className="flex flex-wrap gap-3">
                <button ref={submitButton} type="submit" disabled={sending} className={BUTTON_PRIMARY}>{sending ? "Sending…" : "Submit"}</button>
                <button type="button" onClick={clear} disabled={sending} className={BUTTON_SECONDARY}>Clear message</button>
            </div>
        </form>
    );
}
