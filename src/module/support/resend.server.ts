import "server-only";
import { dashboardLink, failure, PROVIDER_TIMEOUT_MS, statusFailure, transportFailure, type DeliveryPayload, type ProviderResult } from "./provider.server";

export interface ResendConfig {
    apiKey: string | undefined;
    from: string | undefined;
    operator: string | undefined;
    apiUrl: string;
    dashboardBase: string | undefined;
    fetch: typeof fetch;
}

export function defaultResendConfig(): ResendConfig {
    return {
        apiKey: process.env.SUPPORT_RESEND_API_KEY,
        from: process.env.SUPPORT_EMAIL_FROM,
        operator: process.env.SUPPORT_OPERATOR_EMAIL,
        apiUrl: process.env.SUPPORT_RESEND_API_URL || "https://api.resend.com",
        dashboardBase: process.env.SUPPORT_DASHBOARD_BASE_URL,
        fetch,
    };
}

/** Operator mail: reference, category and secure triage link only. */
export function operatorMessage(payload: DeliveryPayload, dashboardBase: string | undefined): { subject: string; text: string } {
    const link = dashboardLink(payload.reportId, dashboardBase);
    return {
        subject: `[iworkhere.space] Support report ${payload.reportId}`,
        text: [`A new support report was received.`, `Reference: ${payload.reportId}`, `Category: ${payload.category}`, link ? `Triage: ${link}` : "Triage: dashboard link not configured"].join("\n"),
    };
}

/** Contact receipt: reference and a generic statement only. */
export function receiptMessage(payload: DeliveryPayload): { subject: string; text: string } {
    return {
        subject: `We received your report ${payload.reportId}`,
        text: [`Thank you for your report to iworkhere.space.`, `Your reference is ${payload.reportId}.`, `You are receiving this message because you chose to be contacted about this report. We will not add you to any mailing list.`].join("\n"),
    };
}

async function send(config: ResendConfig, to: string, message: { subject: string; text: string }, jobId: string): Promise<ProviderResult> {
    if (!config.apiKey || !config.from) return failure("misconfigured");
    try {
        const response = await config.fetch(`${config.apiUrl}/emails`, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `support-${jobId}` },
            body: JSON.stringify({ from: config.from, to: [to], subject: message.subject, text: message.text }),
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
            cache: "no-store",
        });
        if (!response.ok) return statusFailure(response.status);
        const body = await response.json() as { id?: unknown };
        return typeof body.id === "string" && body.id.length <= 120 ? { ok: true, providerRef: `email:${body.id}` } : failure("unknown");
    } catch (error) {
        return transportFailure(error);
    }
}

export function sendOperatorEmail(payload: DeliveryPayload, jobId: string, config: ResendConfig = defaultResendConfig()): Promise<ProviderResult> {
    if (!config.operator) return Promise.resolve(failure("misconfigured"));
    return send(config, config.operator, operatorMessage(payload, config.dashboardBase), jobId);
}

export function sendContactReceipt(payload: DeliveryPayload, jobId: string, config: ResendConfig = defaultResendConfig()): Promise<ProviderResult> {
    if (!payload.contactEmail) return Promise.resolve(failure("misconfigured"));
    return send(config, payload.contactEmail, receiptMessage(payload), jobId);
}
