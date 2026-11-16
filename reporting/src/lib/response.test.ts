import { expect, it } from "vitest";
import { boundedBytes, boundedProtocolText, reportResult } from "./response";
import { reportingModel } from "../../../dashboard/src/lib/reportingModel";
import { reportingFixture, reportingNow } from "../../../dashboard/src/test/reportingFixture";
const report = () => reportingModel({ schemaVersion: 1, range: "24h" }, reportingFixture(), reportingNow);
it("uses B1 positive DTO validation at every nested level", () => {
    for (const key of ["health", "semantics", "limited"] as const) {
        const dto = report(); Object.assign(dto[key], { summary: ["private report text", { stack: "private" }] });
        expect(() => reportResult(dto)).toThrow();
    }
    expect(() => reportResult({ ...report(), email: "private@example.invalid" })).toThrow();
    const dto = report(); dto.vital[0].value = NaN; expect(() => reportResult(dto)).toThrow();
});
it("bounds actual wire bytes without truncation", async () => {
    expect((await boundedBytes(new Response("x".repeat(65536)), 65536)).byteLength).toBe(65536);
    await expect(boundedBytes(new Response("x".repeat(65537)), 65536)).rejects.toThrow("size_limit");
    expect(() => boundedProtocolText(JSON.stringify({ result: { text: "x".repeat(65536) } }), "application/json")).toThrow("size_limit");
});
it("removes reflected input and diagnostic text from SDK errors", () => {
    const text = boundedProtocolText(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "private SQL SELECT", data: { stack: "postgresql://secret" } } }), "application/json");
    expect(text).not.toMatch(/private|SELECT|postgresql|stack/); expect(JSON.parse(text).error.code).toBe(-32602);
    const error = boundedProtocolText(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "private contact" }] } }), "application/json"); expect(error).not.toContain("private");
});
