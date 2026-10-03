/** Diagnostic text only. Context must still be projected from explicit fields. */
export function redactDiagnosticText(value: string): string {
    let text = value.replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi, match => `${match.split(":", 1)[0]}: [REDACTED]`);
    text = text.replace(/\bBearer\s+[^\s,;"'<>]+/gi, "Bearer [REDACTED]");
    text = text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1[REDACTED]@");
    // Preserve terminal line/column references when stripping URL queries/fragments.
    text = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"')]+/gi, location => {
        const cut = location.search(/[?#]/);
        if (cut < 0) return location;
        const frame = location.slice(cut).match(/:\d+(?::\d+)?$/)?.[0] ?? "";
        return location.slice(0, cut) + frame;
    });
    text = text.replace(/(["']?\b(?:password|passwd|passphrase|pwd|token|access_token|refresh_token|api[_-]?key|secret|client_secret|session[_-]?token|[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|DATABASE_URL))["']?\s*[:=]\s*)(\[REDACTED\]|"[^"]*"|'[^']*'|[^\s,;&}\]]+)/gi, "$1[REDACTED]");
    return text;
}

/** UTF-8 byte bound, without cutting a code point or redaction marker. */
export function diagnosticText(value: string, maximum: number): string {
    const clean = redactDiagnosticText(value);
    const encoder = new TextEncoder();
    if (encoder.encode(clean).length <= maximum) return clean;
    const suffix = "\n[TRUNCATED]";
    let remaining = maximum - encoder.encode(suffix).length;
    let result = "";
    for (const point of clean) {
        remaining -= encoder.encode(point).length;
        if (remaining < 0) break;
        result += point;
    }
    return result.replace(/\[REDACTED[^\]]*$/, "") + suffix;
}
