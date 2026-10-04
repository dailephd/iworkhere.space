import type { LogLevel, LogMeta } from "./types";
import type { LogProvider } from "./provider";
import { diagnosticText } from "@/module/observability/diagnosticText";
import { isDiagnosticError, safeLogMeta } from "@/module/observability/logSafety";

class ConsoleProvider implements LogProvider {
    log(level: LogLevel, message: string, meta?: LogMeta): void {
        try {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

            const args: unknown[] = [prefix, diagnosticText(message, 4096)];
            if (meta) {
                args.push({ ...safeLogMeta(meta), ...(isDiagnosticError(meta.diagnosticError) ? { diagnosticError: meta.diagnosticError } : {}) });
            }

            switch (level) {
                case "debug":
                    console.debug(...args);
                    break;
                case "info":
                    console.info(...args);
                    break;
                case "warn":
                    console.warn(...args);
                    break;
                case "error":
                    console.error(...args);
                    break;
            }
        } catch {
            // Never throw
        }
    }
}

let activeProvider: LogProvider = new ConsoleProvider();
let activeLogLevel: LogLevel = "info";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

export function setLogProvider(provider: LogProvider): void {
    activeProvider = provider;
}

export function setLogLevel(level: LogLevel): void {
    activeLogLevel = level;
}

function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[activeLogLevel];
}

export const log = {
    debug: (message: string, meta?: LogMeta) => {
        if (shouldLog("debug")) activeProvider.log("debug", message, meta);
    },
    info: (message: string, meta?: LogMeta) => {
        if (shouldLog("info")) activeProvider.log("info", message, meta);
    },
    warn: (message: string, meta?: LogMeta) => {
        if (shouldLog("warn")) activeProvider.log("warn", message, meta);
    },
    error: (message: string, meta?: LogMeta) => {
        if (shouldLog("error")) activeProvider.log("error", message, meta);
    },
};
