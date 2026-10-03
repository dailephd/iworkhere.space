import type { LogLevel, LogMeta } from "./types";
import type { LogProvider } from "./provider";
import { isDiagnosticError, safeLogMeta } from "@/module/observability/logSafety";
import { currentMetricContext, observabilityEnabled } from "@/module/observability/transport.client";
import { clientDiagnosticContext, createErrorDiagnostic, MAX_DIAGNOSTIC_BYTES, serializeDiagnosticError } from "@/module/observability/diagnostic";
import { diagnosticText } from "@/module/observability/diagnosticText";

export class RustLogProvider implements LogProvider {
    log(level: LogLevel, message: string, meta?: LogMeta): void {
        void this.send(level, message, meta).catch(() => {});
    }

    private async send(level: LogLevel, message: string, meta?: LogMeta): Promise<void> {
        try {
            if (!observabilityEnabled()) return;
            const body = {
                level,
                message: diagnosticText(message, 4096),
                meta: safeLogMeta(meta),
                ...currentMetricContext(),
            };
            const diagnostic = level === "error" || level === "warn"
                ? await createErrorDiagnostic(isDiagnosticError(meta?.diagnosticError) ? meta.diagnosticError : serializeDiagnosticError(new Error(message)), clientDiagnosticContext(meta), "client", level)
                : undefined;
            const payload = JSON.stringify({ ...body, ...(diagnostic ? { diagnostic, message: diagnostic.error.message } : {}) });
            if (new TextEncoder().encode(payload).length > MAX_DIAGNOSTIC_BYTES) return;

            void fetch("/api/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true,
                credentials: "omit",
                referrerPolicy: "no-referrer",
            }).catch(() => {});
        } catch { /* Synchronous transport failures are also fail-silent. */ }
    }
}
