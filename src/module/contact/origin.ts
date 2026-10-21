/**
 * Header checks discourage cross-site browser posts; they are not authentication and not rate limiting.
 *
 * Unlike the report endpoint, a missing Origin is rejected: the contact form is only ever posted by
 * a browser fetch from this site, and browsers always send Origin on such a POST. The Origin host is compared
 * with the host the request was addressed to (the forwarded host behind a proxy, else the Host header).
 */
export function sameOriginContactRequest(request: Request): boolean {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return false;
    const origin = request.headers.get("origin");
    if (!origin) return false;
    const addressed = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
    try { return new URL(origin).host === addressed; } catch { return false; }
}
