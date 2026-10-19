/**
 * Header checks discourage cross-site browser traffic; they are not authentication
 * and not rate limiting. Challenge verification and the intake ceiling are the
 * independent abuse controls.
 *
 * The Origin host is compared with the host the request was addressed to (the forwarded
 * host behind a proxy, else the Host header), because the origin Next.js derives for
 * `request.url` can differ from the public one depending on how the server is started.
 */
export function sameOriginSupportRequest(request: Request): boolean {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return false;
    const origin = request.headers.get("origin");
    if (!origin) return true;
    const addressed = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
    try { return new URL(origin).host === addressed; } catch { return false; }
}
