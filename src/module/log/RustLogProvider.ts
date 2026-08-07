import type { LogLevel, LogMeta } from "./types";
import type { LogProvider } from "./provider";

export class RustLogProvider implements LogProvider {
    log(level: LogLevel, message: string, meta?: LogMeta): void {
        const body = {
            level,
            message,
            meta,
            timestamp: new Date().toISOString(),
            url: typeof window !== "undefined" ? window.location.href : "ssr",
        };

        // Use fetch with try/catch, do not block UI, fail silently
        fetch("/api/log", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }).catch(() => {
            // Fail silently as required
        });
    }
}
