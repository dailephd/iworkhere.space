import "server-only";
import { diagnosticFingerprint, type DeploymentContext, type ErrorDiagnostic } from "./diagnostic";
import { diagnosticText } from "./diagnosticText";
import { redactSerializedError } from "./logSafety";
import { persistenceEnabled, persistDiagnostic } from "./persistence.server";

export function deploymentContext(): DeploymentContext {
    const context: DeploymentContext = {};
    const source = { commitSha: process.env.VERCEL_GIT_COMMIT_SHA, environment: process.env.VERCEL_ENV, region: process.env.VERCEL_REGION, hostname: process.env.VERCEL_URL, deploymentId: process.env.VERCEL_DEPLOYMENT_ID };
    for (const key of Object.keys(source) as Array<keyof DeploymentContext>) if (source[key]) context[key] = diagnosticText(source[key], 256);
    return context;
}
/** Runtime logging succeeds independently of durable persistence. Never recurse. */
export async function reportDiagnostic(diagnostic: ErrorDiagnostic): Promise<void> {
    try {
        const error = redactSerializedError(diagnostic.error);
        const context = { ...diagnostic.context };
        if (context.componentStack) context.componentStack = diagnosticText(context.componentStack, 16384);
        if (context.userAgent) context.userAgent = diagnosticText(context.userAgent, 1024);
        const record: ErrorDiagnostic = { ...diagnostic, error, context, fingerprint: await diagnosticFingerprint(error), deployment: deploymentContext() };
        try {
            const line = JSON.stringify({ source: "application-error", diagnosticId: record.id, ...record });
            if (record.severity === "error") console.error(line);
            else console.warn(line);
        } catch { /* A logging sink must not break an application failure. */ }
        if (persistenceEnabled()) {
            try { await persistDiagnostic(record); }
            catch {
                try { console.error(JSON.stringify({ source: "observability-operation", operation: "diagnostic-insert", diagnosticId: record.id, status: "unavailable" })); } catch { /* Fail safe. */ }
            }
        }
    } catch { /* Serializer/hash failures cannot recursively break error handling. */ }
}
