"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { REPORT_CATEGORY, SUPPORT_LIMIT, type ReportCategory } from "@/module/support/contract";
import { CATEGORY_RULE, categoryRule } from "@/module/support/taxonomy";
import { codePointLength } from "@/module/support/validation";

export interface SupportDraft {
    category: ReportCategory | "";
    /** "site-wide", "other" or "tool:<id>". */
    area: string;
    description: string;
    expected: string;
    observed: string;
    email: string;
    contactConsent: boolean;
}

export interface SupportToolOption { id: string; name: string }

export interface SupportDialogProps {
    tool: readonly SupportToolOption[];
    draft: SupportDraft;
    /** Human-readable error text keyed by field name. */
    fieldMessage: Record<string, string>;
    phase: "idle" | "submitting" | "failed" | "succeeded";
    failureMessage: string | null;
    receiptId: string | null;
    challenge: ReactNode;
    /** False while the challenge has not produced a token or reporting is not configured. */
    canSubmit: boolean;
    notice: string | null;
    onChange(next: SupportDraft): void;
    onSubmit(): void;
    onClose(): void;
}

const CONTROL = "block w-full min-w-0 rounded-lg border border-input-border bg-input-bg p-2 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";
const BUTTON_PRIMARY = "material-primary min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-[var(--contrast)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";
const BUTTON_SECONDARY = "min-h-11 rounded-lg border border-secondary-action-border bg-secondary-action-bg px-4 py-2 text-text disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

interface FieldProps {
    id: string;
    label: string;
    message?: string;
    hint?: string;
    children: (describedBy: string | undefined, invalid: boolean) => ReactNode;
}
function Field({ id, label, message, hint, children }: FieldProps) {
    const describedBy = [hint ? `${id}-hint` : null, message ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
    return <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium">{label}</label>
        {children(describedBy, Boolean(message))}
        {hint ? <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p> : null}
        {message ? <p id={`${id}-error`} className="text-sm text-danger">{message}</p> : null}
    </div>;
}

export function SupportDialog(props: SupportDialogProps) {
    const { tool, draft, fieldMessage, phase, failureMessage, receiptId, challenge, canSubmit, notice, onChange, onSubmit, onClose } = props;
    const id = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    const submitting = phase === "submitting";
    const rule = draft.category ? categoryRule(draft.category) : null;

    useEffect(() => {
        const element = dialog.current;
        if (!element) return;
        // Native modal dialog: focus containment, inert page and Escape. Older engines fall back to a plain open dialog.
        if (typeof element.showModal === "function") element.showModal(); else element.setAttribute("open", "");
        return () => { if (typeof element.close === "function" && element.open) element.close(); };
    }, []);

    function change<K extends keyof SupportDraft>(key: K, value: SupportDraft[K]) { onChange({ ...draft, [key]: value }); }
    function submit(event: FormEvent) { event.preventDefault(); if (!submitting) onSubmit(); }

    return <dialog ref={dialog} aria-labelledby={`${id}-title`} data-testid="support-dialog"
        onCancel={event => { event.preventDefault(); if (!submitting) onClose(); }}
        className="m-auto max-h-[90dvh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-surface p-5 text-text shadow-lg backdrop:bg-black/50">
        <h2 id={`${id}-title`} className="text-xl font-semibold">Report a problem or suggestion</h2>
        {phase === "succeeded" && receiptId ? <div className="mt-4 space-y-4" role="status">
            <p className="font-medium">Thank you. Your report was received.</p>
            <p>Your reference is <code className="rounded bg-surface-alt px-2 py-1 font-mono" data-testid="support-reference">{receiptId}</code>. Keep it if you want to refer to this report later.</p>
            <button type="button" onClick={onClose} className={BUTTON_PRIMARY}>Close</button>
        </div> : <form onSubmit={submit} noValidate aria-busy={submitting} className="mt-3 space-y-4">
            <p className="text-sm text-text-muted">Do not include passwords, secret tokens, private documents or other personal records. We never ask for files or screenshots, and your tool inputs and results are not sent.</p>
            {notice ? <p role="status" className="rounded-lg border border-border bg-surface-alt p-3 text-sm">{notice}</p> : null}
            <fieldset disabled={submitting} className="space-y-4">
                <Field id={`${id}-category`} label="What kind of report is this? (required)" message={fieldMessage.category} hint={rule?.hint}>
                    {(describedBy, invalid) => <select id={`${id}-category`} value={draft.category} required aria-required="true" aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("category", event.target.value as ReportCategory | "")} className={CONTROL}>
                        <option value="">Choose a category</option>
                        {REPORT_CATEGORY.map(category => <option key={category} value={category}>{CATEGORY_RULE.find(item => item.id === category)?.label}</option>)}
                    </select>}
                </Field>
                <Field id={`${id}-area`} label="Where did it happen? (required)" message={fieldMessage.area}>
                    {(describedBy, invalid) => <select id={`${id}-area`} value={draft.area} required aria-required="true" aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("area", event.target.value)} className={CONTROL}>
                        <option value="site-wide">Site-wide</option>
                        {tool.map(item => <option key={item.id} value={`tool:${item.id}`}>{item.name}</option>)}
                        <option value="other">Other</option>
                    </select>}
                </Field>
                <Field id={`${id}-description`} label="Describe what happened (required)" message={fieldMessage.description} hint={`${codePointLength(draft.description)} / ${SUPPORT_LIMIT.description} characters`}>
                    {(describedBy, invalid) => <textarea id={`${id}-description`} value={draft.description} rows={5} required aria-required="true" aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("description", event.target.value)} className={CONTROL} />}
                </Field>
                {rule ? <Field id={`${id}-expected`} label={rule.expectedRequired ? `${rule.expectedLabel} (required)` : rule.expectedLabel} message={fieldMessage.expected} hint={`${codePointLength(draft.expected)} / ${SUPPORT_LIMIT.expected} characters`}>
                    {(describedBy, invalid) => <textarea id={`${id}-expected`} value={draft.expected} rows={3} required={rule.expectedRequired} aria-required={rule.expectedRequired} aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("expected", event.target.value)} className={CONTROL} />}
                </Field> : null}
                {rule ? <Field id={`${id}-observed`} label={rule.observedLabel} message={fieldMessage.observed} hint={`${codePointLength(draft.observed)} / ${SUPPORT_LIMIT.observed} characters`}>
                    {(describedBy, invalid) => <textarea id={`${id}-observed`} value={draft.observed} rows={3} aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("observed", event.target.value)} className={CONTROL} />}
                </Field> : null}
                <Field id={`${id}-email`} label="Email for a receipt or follow-up (optional)" message={fieldMessage.email} hint="Optional. We only use your address if you check the box below.">
                    {(describedBy, invalid) => <input id={`${id}-email`} type="email" value={draft.email} autoComplete="email" aria-invalid={invalid} aria-describedby={describedBy}
                        onChange={event => change("email", event.target.value)} className={CONTROL} />}
                </Field>
                <div className="space-y-1">
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                        <input type="checkbox" checked={draft.contactConsent} onChange={event => change("contactConsent", event.target.checked)} className="mt-1 accent-[var(--accent)]"
                            aria-invalid={Boolean(fieldMessage.contactConsent)} aria-describedby={fieldMessage.contactConsent ? `${id}-consent-error` : undefined} />
                        <span>You may email me a receipt and contact me about this report.</span>
                    </label>
                    {fieldMessage.contactConsent ? <p id={`${id}-consent-error`} className="text-sm text-danger">{fieldMessage.contactConsent}</p> : null}
                </div>
            </fieldset>
            <div>{challenge}{fieldMessage.challenge ? <p className="text-sm text-danger">{fieldMessage.challenge}</p> : null}</div>
            {failureMessage ? <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-3 text-sm">{failureMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={submitting || !canSubmit} className={BUTTON_PRIMARY}>{submitting ? "Sending…" : phase === "failed" ? "Try again" : "Send report"}</button>
                <button type="button" onClick={onClose} disabled={submitting} className={BUTTON_SECONDARY}>Cancel</button>
            </div>
        </form>}
    </dialog>;
}
