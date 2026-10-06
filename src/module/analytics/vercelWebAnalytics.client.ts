/** Public build-time opt-in. The separate application analytics provider is unchanged. */
export function vercelWebAnalyticsEnabled(flag = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED): boolean {
    return flag === "true";
}

export interface VercelPageView {
    type: "pageview";
    url: string;
}

/** Only page views with reconstructible HTTP(S) URLs may leave this boundary. */
export function sanitizeVercelPageView(event: unknown): VercelPageView | null {
    try {
        if (typeof event !== "object" || event === null) return null;
        const { type, url } = event as Record<string, unknown>;
        if (type !== "pageview" || typeof url !== "string" || !url || /[\s\\]/.test(url)) return null;
        const relative = url.startsWith("/") && !url.startsWith("//");
        if (!relative && !/^https?:\/\//i.test(url)) return null;
        const parsed = new URL(url, relative ? "https://relative.invalid" : undefined);
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
        parsed.search = "";
        parsed.hash = "";
        // Project explicit fields; unexpected payload/identity fields are never forwarded.
        return { type: "pageview", url: relative ? parsed.pathname : parsed.href };
    } catch {
        return null;
    }
}
