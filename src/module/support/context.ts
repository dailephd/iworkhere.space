import type { SupportToolProjection } from "./contract";
import { SUPPORT_LIMIT } from "./contract";

/** Canonical public routes plus the registry-derived identities a report may reference. */
export interface SupportContextSource {
    tool: readonly SupportToolProjection[];
    category: readonly string[];
}

export interface ReportContext {
    toolId: string | null;
    pathname: string;
}

const STATIC_PATHNAME = ["/", "/discover", "/privacy"] as const;
const SAFE_PATHNAME = /^\/[a-zA-Z0-9/_-]*$/;

export function isSafePathname(pathname: string): boolean {
    return SAFE_PATHNAME.test(pathname) && !pathname.startsWith("//") && pathname.length <= SUPPORT_LIMIT.pathname;
}

/** Strict allowlist: a pathname containing a query, hash or unknown route is never accepted. */
export function isAllowedPathname(pathname: string, source: SupportContextSource): boolean {
    if (!isSafePathname(pathname)) return false;
    if ((STATIC_PATHNAME as readonly string[]).includes(pathname)) return true;
    if (pathname.startsWith("/tool/")) return source.tool.some(item => `/tool/${item.slug}` === pathname);
    if (pathname.startsWith("/category/")) return source.category.some(item => `/category/${item}` === pathname);
    return false;
}

export function toolIdForPathname(pathname: string, source: SupportContextSource): string | null {
    if (!pathname.startsWith("/tool/")) return null;
    return source.tool.find(item => `/tool/${item.slug}` === pathname)?.id ?? null;
}

/** Default context from the browser pathname; unknown or malformed routes fall back to Site-wide on "/". */
export function resolveReportContext(pathname: string, source: SupportContextSource): ReportContext {
    if (!isAllowedPathname(pathname, source)) return { toolId: null, pathname: "/" };
    return { toolId: toolIdForPathname(pathname, source), pathname };
}
