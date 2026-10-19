"use client";

import { useCallback, useRef, useState } from "react";
import type { FieldErrorMap, ReportReceipt, ReportRequest } from "./contract";
import { SUPPORT_SCHEMA_VERSION } from "./contract";

export type SubmissionPhase = "idle" | "submitting" | "failed" | "succeeded";
export type SubmissionFailure = "network" | "offline" | "unavailable" | "rate_limited" | "challenge_failed" | "invalid" | "conflict" | "too_large" | "unexpected";

export type PostOutcome =
    | { kind: "receipt"; receipt: ReportReceipt }
    | { kind: "failure"; failure: SubmissionFailure; fieldError?: FieldErrorMap };

const REPORT_ID = /^SR-[0-9A-HJKMNP-TV-Z]{16}$/;

function receiptFrom(body: unknown): ReportReceipt | null {
    if (typeof body !== "object" || body === null) return null;
    const value = body as Record<string, unknown>;
    if (value.schemaVersion !== SUPPORT_SCHEMA_VERSION || typeof value.reportId !== "string" || !REPORT_ID.test(value.reportId) || typeof value.receivedAt !== "string") return null;
    return { schemaVersion: SUPPORT_SCHEMA_VERSION, reportId: value.reportId, receivedAt: value.receivedAt };
}

/** Sends one report. Success is reported only for a 201 carrying a well-formed durable receipt. */
export async function postReport(request: ReportRequest, fetcher: typeof fetch = fetch): Promise<PostOutcome> {
    let response: Response;
    try {
        response = await fetcher("/api/support/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
            credentials: "omit",
            referrerPolicy: "no-referrer",
            cache: "no-store",
        });
    } catch {
        return { kind: "failure", failure: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network" };
    }
    let body: unknown = null;
    try { body = await response.json(); } catch { /* A non-JSON body is treated as an unexpected response below. */ }
    if (response.status === 201) {
        const receipt = receiptFrom(body);
        return receipt ? { kind: "receipt", receipt } : { kind: "failure", failure: "unexpected" };
    }
    const error = typeof body === "object" && body !== null ? (body as { error?: unknown; fieldError?: unknown }) : {};
    if (response.status === 400) return { kind: "failure", failure: "invalid", fieldError: typeof error.fieldError === "object" && error.fieldError !== null ? error.fieldError as FieldErrorMap : undefined };
    if (response.status === 409) return { kind: "failure", failure: "conflict" };
    if (response.status === 413) return { kind: "failure", failure: "too_large" };
    if (response.status === 429) return { kind: "failure", failure: error.error === "challenge_failed" ? "challenge_failed" : "rate_limited" };
    if (response.status === 503) return { kind: "failure", failure: "unavailable" };
    return { kind: "failure", failure: "unexpected" };
}

export interface SubmissionState {
    phase: SubmissionPhase;
    receipt: ReportReceipt | null;
    failure: SubmissionFailure | null;
    fieldError: FieldErrorMap;
}

const IDLE: SubmissionState = { phase: "idle", receipt: null, failure: null, fieldError: {} };

/** Single-flight submission state machine: idle -> submitting -> succeeded | failed -> submitting. */
export function useSupportSubmission(fetcher?: typeof fetch) {
    const [state, setState] = useState<SubmissionState>(IDLE);
    const inFlight = useRef(false);
    const submit = useCallback(async (request: ReportRequest): Promise<PostOutcome | null> => {
        if (inFlight.current) return null; // A duplicate activation never sends a second request.
        inFlight.current = true;
        setState(current => ({ ...current, phase: "submitting", failure: null, fieldError: {} }));
        try {
            const outcome = await postReport(request, fetcher);
            if (outcome.kind === "receipt") setState({ phase: "succeeded", receipt: outcome.receipt, failure: null, fieldError: {} });
            else setState({ phase: "failed", receipt: null, failure: outcome.failure, fieldError: outcome.fieldError ?? {} });
            return outcome;
        } finally { inFlight.current = false; }
    }, [fetcher]);
    const reset = useCallback(() => setState(IDLE), []);
    return { state, submit, reset };
}
