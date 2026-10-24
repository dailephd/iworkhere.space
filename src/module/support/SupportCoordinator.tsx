"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SupportDialog, type SupportDraft } from "@/component/support/SupportDialog";
import type { FieldErrorMap, ReportRequest } from "./contract";
import { SUPPORT_SCHEMA_VERSION } from "./contract";
import { resolveReportContext, type SupportContextSource } from "./context";
import { useSupportSubmission, type SubmissionFailure } from "./submission.client";
import { TurnstileChallenge, type TurnstileHandle } from "./TurnstileChallenge";
import { parseReportRequest } from "./validation";

export interface SupportCoordinatorProps {
    /** Serializable registry projection from the server layout; never a ToolDefinition. */
    source: SupportContextSource;
    /** Public Turnstile site key; when absent the form cannot be submitted (fail closed). */
    siteKey?: string;
}

const FIELD_MESSAGE = {
    required: "This field is required.",
    too_long: "This is too long.",
    invalid: "This value is not valid.",
    unknown_field: "This field is not accepted.",
} as const;

const FAILURE_MESSAGE: Record<SubmissionFailure, string> = {
    network: "We could not reach the server. Your report has not been sent. Check your connection and try again.",
    offline: "You appear to be offline. Your report has not been sent. Reconnect and try again.",
    unavailable: "Reporting is temporarily unavailable. Your report has not been saved. Please try again later.",
    rate_limited: "Too many reports are arriving right now. Please try again in a few minutes.",
    challenge_failed: "The verification check failed. Complete it again and retry.",
    invalid: "Some fields need attention. Your text has been kept.",
    conflict: "This report changed after a failed attempt. Send it again.",
    too_large: "The report is too large. Shorten it and try again.",
    unexpected: "Something went wrong and your report may not have been saved. Please try again.",
};

const TRIGGER_LABEL = "Report Issues";
// The accessible name contains the visible words, so speech input ("click Report Issues") and label-in-name checks work.
const TRIGGER_ACCESSIBLE_NAME = "Report Issues — report a problem or suggestion";

const FIELD_ALIAS: Record<string, string> = { toolId: "area", turnstileToken: "challenge", pathname: "area" };

function emptyDraft(area: string): SupportDraft {
    return { category: "", area, description: "", expected: "", observed: "", email: "", contactConsent: false };
}

export function messageForFieldError(error: FieldErrorMap): Record<string, string> {
    const message: Record<string, string> = {};
    for (const [field, code] of Object.entries(error)) message[FIELD_ALIAS[field] ?? field] = FIELD_MESSAGE[code];
    return message;
}

function requestFrom(draft: SupportDraft, pathname: string, idempotencyKey: string, turnstileToken: string): ReportRequest {
    const tool = draft.area.startsWith("tool:");
    return {
        schemaVersion: SUPPORT_SCHEMA_VERSION,
        category: draft.category as ReportRequest["category"],
        area: tool ? "tool" : draft.area === "other" ? "other" : "site-wide",
        ...(tool ? { toolId: draft.area.slice(5) } : {}),
        pathname,
        description: draft.description,
        ...(draft.expected ? { expected: draft.expected } : {}),
        ...(draft.observed ? { observed: draft.observed } : {}),
        ...(draft.email ? { email: draft.email } : {}),
        contactConsent: draft.contactConsent,
        idempotencyKey,
        turnstileToken,
    };
}

/** Owns the footer trigger, route context and submission state; the dialog stays presentational. */
export function SupportCoordinator({ source, siteKey }: SupportCoordinatorProps) {
    const pathname = usePathname();
    const context = useMemo(() => resolveReportContext(pathname ?? "/", source), [pathname, source]);
    const defaultArea = context.toolId ? `tool:${context.toolId}` : "site-wide";
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<SupportDraft>(() => emptyDraft(defaultArea));
    const [touched, setTouched] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [localError, setLocalError] = useState<Record<string, string>>({});
    const submissionContext = useRef(context);
    const trigger = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef(false);
    const challenge = useRef<TurnstileHandle>(null);
    const key = useRef<{ value: string; signature: string } | null>(null);
    const { state, submit, reset } = useSupportSubmission();

    const openDialog = useCallback(() => {
        submissionContext.current = context;
        setDraft(current => touched ? current : { ...current, area: defaultArea });
        setLocalError({});
        setOpen(true);
    }, [context, defaultArea, touched]);

    const closeDialog = useCallback(() => {
        setOpen(false);
        if (state.phase === "succeeded") {
            setDraft(emptyDraft(defaultArea));
            setTouched(false);
            key.current = null;
            reset();
        }
        returnFocus.current = true;
    }, [defaultArea, reset, state.phase]);

    // The trigger is inert while the modal dialog is open, so focus can only return after the dialog has unmounted.
    useEffect(() => {
        if (open || !returnFocus.current) return;
        returnFocus.current = false;
        trigger.current?.focus();
    }, [open]);

    async function send() {
        if (!token) return;
        const signature = JSON.stringify(draft);
        // A changed draft is a different report, so it needs a new idempotency key; an unchanged retry reuses the key.
        if (!key.current || key.current.signature !== signature) key.current = { value: crypto.randomUUID(), signature };
        const request = requestFrom(draft, submissionContext.current.pathname, key.current.value, token);
        const parsed = parseReportRequest(request, source);
        if (!parsed.ok) { setLocalError(messageForFieldError(parsed.fieldError)); return; }
        setLocalError({});
        const outcome = await submit(request);
        if (outcome?.kind === "failure" && outcome.failure === "conflict") key.current = null;
        challenge.current?.reset(); // Challenge tokens are single use.
    }

    const failureMessage = state.failure ? FAILURE_MESSAGE[state.failure] : null;
    const notice = siteKey ? null : "Reporting is not available right now.";
    const dialog = open ? <SupportDialog
        tool={source.tool.map(item => ({ id: item.id, name: item.name }))}
        draft={draft}
        fieldMessage={{ ...messageForFieldError(state.fieldError), ...localError }}
        phase={state.phase}
        failureMessage={failureMessage}
        receiptId={state.receipt?.reportId ?? null}
        challenge={siteKey ? <TurnstileChallenge ref={challenge} siteKey={siteKey} onToken={setToken} /> : null}
        canSubmit={Boolean(siteKey && token)}
        notice={notice}
        onChange={next => { setDraft(next); setTouched(true); }}
        onSubmit={send}
        onClose={closeDialog}
    /> : null;

    return <>
        <button ref={trigger} type="button" onClick={openDialog} aria-haspopup="dialog" aria-label={TRIGGER_ACCESSIBLE_NAME}
            className="inline-flex min-h-6 w-fit items-center rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]">
            {TRIGGER_LABEL}
        </button>
        {dialog ? createPortal(dialog, document.body) : null}
    </>;
}
