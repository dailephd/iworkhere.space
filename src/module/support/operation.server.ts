import "server-only";

export type SupportOperation = "intake" | "challenge" | "delivery" | "maintenance";

/** Fixed operational message only: no request fields, report text, addresses, tokens or thrown diagnostics. */
export function reportSupportFailure(operation: SupportOperation, code: string): void {
    console.error(JSON.stringify({ source: "support-operation", operation, status: "failed", code }));
}
