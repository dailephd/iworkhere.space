import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";

/** Minimal parameterized-query surface so tests can inject a database double. */
export interface SupportSql {
    query(text: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

// Development and test seam: a disposable local database can stand behind the HTTP driver.
// Only an http loopback /sql endpoint is honoured, so production traffic can never be redirected.
const LOOPBACK_ENDPOINT = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/sql$/;

export function loopbackEndpoint(value: string | undefined): string | null {
    return value && LOOPBACK_ENDPOINT.test(value) ? value : null;
}

/** The only constructor of support database connections; credentials come from the caller's environment variable. */
export function connectSupport(url: string, timeoutMs: number): SupportSql {
    const endpoint = loopbackEndpoint(process.env.SUPPORT_DATABASE_HTTP_ENDPOINT);
    if (endpoint) neonConfig.fetchEndpoint = endpoint;
    return neon(url, { fetchOptions: { signal: AbortSignal.timeout(timeoutMs) } }) as SupportSql;
}
