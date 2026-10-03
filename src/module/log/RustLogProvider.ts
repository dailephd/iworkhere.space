import type { LogLevel, LogMeta } from "./types";
import type { LogProvider } from "./provider";
import { safeLogMeta } from "@/module/observability/logSafety";
import { currentMetricContext, observabilityEnabled } from "@/module/observability/transport.client";

export class RustLogProvider implements LogProvider {
    log(level: LogLevel, message: string, meta?: LogMeta): void {
        try {
            if (!observabilityEnabled()) return;
            const body = {
                level,
                message: level === "error" || level === "warn" ? "Client failure" : "Application event",
                meta: safeLogMeta(meta),
                ...currentMetricContext(),
            };

            void fetch("/api/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                keepalive: true,
                credentials: "omit",
                referrerPolicy: "no-referrer",
            }).catch(() => {});
        } catch { /* Synchronous transport failures are also fail-silent. */ }
    }
}
