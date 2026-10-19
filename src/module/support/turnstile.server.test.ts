import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultChallengeDependency, verifyChallenge } from "./turnstile.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("verifyChallenge", () => {
    it("posts only the secret and response to the verifier and accepts success", async () => {
        const fetcher = vi.fn().mockResolvedValue(json({ success: true }));
        expect(await verifyChallenge("token-1", { fetch: fetcher, secret: "server-secret", verifyUrl: "https://verify.test/siteverify" })).toBe("ok");
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("https://verify.test/siteverify");
        expect(init.method).toBe("POST");
        expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ secret: "server-secret", response: "token-1" });
    });
    it("rejects an unsuccessful verification", async () => {
        const dep = { fetch: vi.fn().mockResolvedValue(json({ success: false, "error-codes": ["invalid-input-response"] })), secret: "s", verifyUrl: "https://verify.test" };
        expect(await verifyChallenge("bad", dep)).toBe("rejected");
        expect(await verifyChallenge("bad", { ...dep, fetch: vi.fn().mockResolvedValue(json({})) })).toBe("rejected");
        expect(await verifyChallenge("bad", { ...dep, fetch: vi.fn().mockResolvedValue(json({ success: "true" })) })).toBe("rejected");
    });
    it("fails closed without a secret and never calls the verifier", async () => {
        const fetcher = vi.fn();
        expect(await verifyChallenge("token", { fetch: fetcher, secret: undefined, verifyUrl: "https://verify.test" })).toBe("unavailable");
        expect(await verifyChallenge("token", { fetch: fetcher, secret: "", verifyUrl: "https://verify.test" })).toBe("unavailable");
        expect(fetcher).not.toHaveBeenCalled();
    });
    it("fails closed when the verifier errors, times out or returns a non-JSON body", async () => {
        const base = { secret: "s", verifyUrl: "https://verify.test" };
        expect(await verifyChallenge("t", { ...base, fetch: vi.fn().mockRejectedValue(new Error("network")) })).toBe("unavailable");
        expect(await verifyChallenge("t", { ...base, fetch: vi.fn().mockResolvedValue(json({}, 500)) })).toBe("unavailable");
        expect(await verifyChallenge("t", { ...base, fetch: vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })) })).toBe("unavailable");
    });
    it("never logs the token or the secret", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const info = vi.spyOn(console, "log").mockImplementation(() => {});
        await verifyChallenge("token-xyz", { fetch: vi.fn().mockRejectedValue(new Error("token-xyz server-secret")), secret: "server-secret", verifyUrl: "https://verify.test" });
        expect(JSON.stringify([log.mock.calls, info.mock.calls])).not.toMatch(/token-xyz|server-secret/);
    });
});

describe("defaultChallengeDependency", () => {
    it("targets Cloudflare by default and reads the secret from the server environment only", () => {
        vi.stubEnv("SUPPORT_TURNSTILE_SECRET", "env-secret");
        vi.stubEnv("SUPPORT_TURNSTILE_VERIFY_URL", "");
        const dep = defaultChallengeDependency();
        expect(dep.verifyUrl).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
        expect(dep.secret).toBe("env-secret");
    });
    it("allows an isolated environment to point at a substitute verifier", () => {
        vi.stubEnv("SUPPORT_TURNSTILE_VERIFY_URL", "http://127.0.0.1:9/verify");
        expect(defaultChallengeDependency().verifyUrl).toBe("http://127.0.0.1:9/verify");
    });
});
