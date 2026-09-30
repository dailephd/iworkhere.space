import { describe, expect, it } from "vitest";
import { getConsoleFailure } from "../test/e2e/support/browserDiagnostic";

describe("E2E console diagnostic gate", () => {
    it.each([
        { type: "error", text: "ordinary console failure" },
        { type: "error", text: "Minified React error #418" },
        { type: "warning", text: "Hydration failed" },
        { type: "warning", text: "Text content did not match" },
        { type: "warning", text: "The server rendered HTML does not match" },
    ])("fails $type: $text without an allowlist", message => {
        expect(getConsoleFailure(message)).not.toBeNull();
    });

    it("does not classify an unrelated informational message as an error", () => {
        expect(getConsoleFailure({ type: "info", text: "Application ready" })).toBeNull();
    });
});
