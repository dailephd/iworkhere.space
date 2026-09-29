import type { LogLevel, LogMeta } from "./types";

export interface LogProvider {
    log(level: LogLevel, message: string, meta?: LogMeta): void;
}
