import { describe, expect, it } from "vitest";
import { createErrorDiagnostic, diagnosticContext, MAX_DIAGNOSTIC_BYTES, serializeDiagnosticError } from "./diagnostic";
import { diagnosticText, redactDiagnosticText } from "./diagnosticText";
import { isClientDiagnostic } from "./logSafety";

describe("diagnostic text redaction", () => {
    it.each([
        ["Authorization: Basic fixture-auth", "fixture-auth"],
        ["Authorization: Bearer fixture-bearer", "fixture-bearer"],
        ["request failed Bearer fixture-token", "fixture-token"],
        ["password=fixture-password", "fixture-password"],
        ['{"password":"fixture-password"}', "fixture-password"],
        ["passwd: 'fixture-password'", "fixture-password"],
        ["token=fixture-token", "fixture-token"],
        ["access_token=fixture-access", "fixture-access"],
        ["refresh_token: fixture-refresh", "fixture-refresh"],
        ["apiKey=fixture-key", "fixture-key"],
        ["api_key: fixture-key", "fixture-key"],
        ["API_KEY=fixture-key", "fixture-key"],
        ["secret=fixture-secret", "fixture-secret"],
        ["client_secret: fixture-secret", "fixture-secret"],
        ["Cookie: session=fixture-cookie; other=value", "fixture-cookie"],
        ["Set-Cookie: session=fixture-cookie; Secure", "fixture-cookie"],
        ["postgresql://fixture-user:fixture-password@db.example/db", "fixture-password"],
        ["https://fixture-user:fixture-password@example.com/path", "fixture-password"],
        ["OBSERVABILITY_DATABASE_URL=postgresql://fixture-user:fixture-password@db.example/db", "fixture-password"],
        ["OBSERVABILITY_DASHBOARD_DATABASE_URL=fixture-secret", "fixture-secret"],
        ["CRON_SECRET=fixture-secret", "fixture-secret"],
        ["VERCEL_TOKEN=fixture-secret", "fixture-secret"],
        ["SESSION_TOKEN=fixture-secret", "fixture-secret"],
    ])("redacts concrete secret value in %s", (input, secret) => {
        const text = redactDiagnosticText(`Resize failed: ${input}\n at resize (https://example.com/app.js:40:2)`);
        expect(text).toContain("[REDACTED]");
        expect(text).not.toContain(secret);
        expect(text).toContain("Resize failed");
        expect(text).toContain("app.js:40:2");
        expect(redactDiagnosticText(text)).toBe(text);
    });
    it("preserves ordinary debugging text and strips location query/hash", () => {
        expect(redactDiagnosticText("Resize worker initialization failed")).toBe("Resize worker initialization failed");
        expect(redactDiagnosticText("at resize (https://example.com/app.js?token=fixture#private:40:2)")).toBe("at resize (https://example.com/app.js:40:2)");
    });
    it("uses UTF-8 bounds and preserves valid Unicode", () => {
        const text = diagnosticText("😀".repeat(2000), 4096);
        expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(4096);
        expect(text).toContain("[TRUNCATED]");
        expect(text).not.toContain("�");
    });
});
describe("canonical errors", () => {
    it.each([Error, TypeError, RangeError])("preserves %s name, actual message and useful stack", Constructor => {
        const error = new Constructor("Resize worker initialization failed");
        const result = serializeDiagnosticError(error);
        expect(result.name).toBe(error.name);
        expect(result.message).toBe(error.message);
        expect(result.stack).toContain("diagnostic.test.ts");
        expect(result.message).not.toBe("Client failure");
    });
    it("preserves custom name and explicit primitive fields without arbitrary properties", () => {
        const error = Object.assign(new Error("worker failed"), { name: "WorkerError", code: "EWORKER", digest: "digest-123", status: 503, statusCode: "503", errno: -1, syscall: "spawn", type: "worker", input: "private-input", file: new Blob(["private-bytes"]) });
        expect(serializeDiagnosticError(error)).toMatchObject({ name: "WorkerError", code: "EWORKER", digest: "digest-123", status: 503, statusCode: "503", errno: -1, syscall: "spawn", type: "worker" });
        expect(JSON.stringify(serializeDiagnosticError(error))).not.toMatch(/private-input|private-bytes/);
    });
    it("captures nested causes and detects cycles", () => {
        const child = new TypeError("cause detail");
        const error = new Error("root detail", { cause: child });
        Object.defineProperty(child, "cause", { value: error });
        expect(serializeDiagnosticError(error).cause).toMatchObject({ name: "TypeError", message: "cause detail", cause: { name: "CircularCause", message: "[CIRCULAR]" } });
    });
    it("truncates cause depth after five", () => {
        let error = new Error("deepest");
        for (let index = 0; index < 10; index++) error = new Error(`cause ${index}`, { cause: error });
        let result = serializeDiagnosticError(error);
        for (let index = 0; index < 6; index++) result = result.cause!;
        expect(result).toMatchObject({ truncated: true, message: "[TRUNCATED]" });
    });
    it("captures at most ten AggregateError children", () => {
        const result = serializeDiagnosticError(new AggregateError(Array.from({ length: 12 }, (_, i) => new RangeError(`child ${i}`)), "aggregate failed"));
        expect(result.errors).toHaveLength(10);
        expect(result.errors?.[0]).toMatchObject({ name: "RangeError", message: "child 0" });
        expect(result.truncated).toBe(true);
    });
    it("preserves DOMException fields", () => expect(serializeDiagnosticError(new DOMException("decode failed", "InvalidStateError"))).toMatchObject({ name: "InvalidStateError", message: "decode failed", code: 11 }));
    it.each(["safe rejection reason", 42, false, undefined, null, { input: "private-input", token: "private-token" }, new Blob(["private-file-content"])])("represents non-Error %j without object dumps", value => {
        const result = serializeDiagnosticError(value);
        expect(result.name).toBe("NonErrorRejection");
        expect(JSON.stringify(result)).not.toMatch(/private-input|private-token|private-file-content/);
        if (typeof value === "string") expect(result.message).toBe(value);
    });
    it("excludes payload metadata and bounds component stack", () => {
        const context = diagnosticContext({ toolId: "image-resizer", boundary: "ToolClientFrame.setQuery", failureCategory: "tool-render-error", componentStack: "component\n".repeat(3000), input: "private-input", file: new Blob(["private-file"]), query: { text: "private-text" }, storage: "private-storage" });
        expect(context.boundary).toBe("ToolClientFrame.setQuery");
        expect(new TextEncoder().encode(context.componentStack).length).toBeLessThanOrEqual(16384);
        expect(JSON.stringify(context)).not.toMatch(/private/);
    });
    it("uses distinct UUIDs and stable fingerprints excluding runtime context", async () => {
        const error = serializeDiagnosticError(new Error("Resize worker initialization failed"));
        const a = await createErrorDiagnostic(error, { pathname: "/", failureCategory: "unknown", userAgent: "browser one" }, "client");
        const b = await createErrorDiagnostic(error, { pathname: "/tool/image-resizer", failureCategory: "window-error", userAgent: "browser two" }, "client");
        expect(a.id).not.toBe(b.id);
        expect(a.fingerprint).toBe(b.fingerprint);
        expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(isClientDiagnostic(a)).toBe(true);
    });
    it("bounds oversized escaped diagnostics deterministically", async () => {
        const error = new Error("\u0001".repeat(12000));
        error.stack = "\u0002".repeat(50000);
        const d = await createErrorDiagnostic(serializeDiagnosticError(error), { pathname: "/", failureCategory: "unknown", componentStack: diagnosticText("\u0003".repeat(30000), 16384) }, "client");
        expect(new TextEncoder().encode(JSON.stringify(d)).length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_BYTES);
        expect(isClientDiagnostic(d)).toBe(true);
    });
});
