import "server-only";

export type ChallengeResult = "ok" | "rejected" | "unavailable";

export interface ChallengeDependency {
    fetch: typeof fetch;
    secret: string | undefined;
    verifyUrl: string;
}

const DEFAULT_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function defaultChallengeDependency(): ChallengeDependency {
    return {
        fetch,
        secret: process.env.SUPPORT_TURNSTILE_SECRET,
        // Overridable only to point an isolated environment at a substitute verifier.
        verifyUrl: process.env.SUPPORT_TURNSTILE_VERIFY_URL || DEFAULT_VERIFY_URL,
    };
}

/** Server-side Turnstile verification. A missing secret or unreachable verifier fails closed. */
export async function verifyChallenge(token: string, dependency: ChallengeDependency = defaultChallengeDependency()): Promise<ChallengeResult> {
    if (!dependency.secret) return "unavailable";
    try {
        const response = await dependency.fetch(dependency.verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ secret: dependency.secret, response: token }).toString(),
            signal: AbortSignal.timeout(5_000),
            cache: "no-store",
        });
        if (!response.ok) return "unavailable";
        const body: unknown = await response.json();
        return typeof body === "object" && body !== null && (body as { success?: unknown }).success === true ? "ok" : "rejected";
    } catch {
        return "unavailable";
    }
}
