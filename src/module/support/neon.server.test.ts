import { afterEach, describe, expect, it, vi } from "vitest";
import { connectSupport, loopbackEndpoint } from "./neon.server";

const { neonMock, neonConfig } = vi.hoisted(() => ({ neonMock: vi.fn(() => ({ query: vi.fn() })), neonConfig: { fetchEndpoint: undefined as unknown } }));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock, neonConfig }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); neonConfig.fetchEndpoint = undefined; });

describe("loopbackEndpoint", () => {
    it.each(["http://127.0.0.1:4010/sql", "http://localhost:4010/sql"])("honours %s", value => expect(loopbackEndpoint(value)).toBe(value));
    it.each([undefined, "", "https://127.0.0.1:4010/sql", "http://example.com:4010/sql", "http://127.0.0.1/sql", "http://127.0.0.1:4010/other", "http://127.0.0.1.evil.example:4010/sql", "http://user@127.0.0.1:4010/sql", "http://0.0.0.0:4010/sql"])("ignores %j", value => expect(loopbackEndpoint(value)).toBeNull());
});

describe("connectSupport", () => {
    it("uses the default Neon endpoint unless a loopback override is configured", () => {
        vi.stubEnv("SUPPORT_DATABASE_HTTP_ENDPOINT", "");
        connectSupport("postgresql://u:p@example.invalid/db", 1000);
        expect(neonConfig.fetchEndpoint).toBeUndefined();
        expect(neonMock).toHaveBeenCalledWith("postgresql://u:p@example.invalid/db", expect.objectContaining({ fetchOptions: expect.anything() }));
    });
    it("never redirects the driver to a non-loopback endpoint", () => {
        vi.stubEnv("SUPPORT_DATABASE_HTTP_ENDPOINT", "https://attacker.example/sql");
        connectSupport("postgresql://u:p@example.invalid/db", 1000);
        expect(neonConfig.fetchEndpoint).toBeUndefined();
    });
    it("points the driver at a disposable local endpoint when it is loopback", () => {
        vi.stubEnv("SUPPORT_DATABASE_HTTP_ENDPOINT", "http://127.0.0.1:4010/sql");
        connectSupport("postgresql://u:p@example.invalid/db", 1000);
        expect(neonConfig.fetchEndpoint).toBe("http://127.0.0.1:4010/sql");
    });
});
