import { describe, test, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
});

function makeRequest(body: unknown): Request {
    return new Request("http://localhost/api/log", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

describe("POST /api/log", () => {
    test("returns 204 for valid log event", async () => {
        const body = {
            level: "info",
            message: "test message",
            timestamp: "2026-01-01T00:00:00Z",
        };
        const response = await POST(makeRequest(body));
        expect(response.status).toBe(204);
    });

    test("writes to console.log on success", async () => {
        const body = {
            level: "warn",
            message: "something happened",
            timestamp: "2026-01-01T00:00:00Z",
        };
        await POST(makeRequest(body));
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining("[WARN] something happened"),
        );
    });

    test("includes meta in log output when provided", async () => {
        const body = {
            level: "info",
            message: "with meta",
            timestamp: "2026-01-01T00:00:00Z",
            meta: { toolId: "calc" },
        };
        await POST(makeRequest(body));
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining("with meta"),
        );
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining("calc"),
        );
    });

    test("returns 400 for missing level", async () => {
        const body = { message: "no level", timestamp: "2026-01-01T00:00:00Z" };
        const response = await POST(makeRequest(body));
        expect(response.status).toBe(400);
    });

    test("returns 400 for missing message", async () => {
        const body = { level: "info", timestamp: "2026-01-01T00:00:00Z" };
        const response = await POST(makeRequest(body));
        expect(response.status).toBe(400);
    });

    test("returns 400 for missing timestamp", async () => {
        const body = { level: "info", message: "no ts" };
        const response = await POST(makeRequest(body));
        expect(response.status).toBe(400);
    });

    test("returns 400 for invalid log level", async () => {
        const body = {
            level: "critical",
            message: "bad level",
            timestamp: "2026-01-01T00:00:00Z",
        };
        const response = await POST(makeRequest(body));
        expect(response.status).toBe(400);
    });

    test("returns 400 for invalid JSON body", async () => {
        const request = new Request("http://localhost/api/log", {
            method: "POST",
            body: "not-json",
            headers: { "Content-Type": "application/json" },
        });
        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    test("accepts all valid log levels", async () => {
        for (const level of ["debug", "info", "warn", "error"]) {
            const body = { level, message: "test", timestamp: "2026-01-01T00:00:00Z" };
            const response = await POST(makeRequest(body));
            expect(response.status).toBe(204);
        }
    });
});
