import { describe, expect, it } from "vitest";
import { REPORT_CATEGORY } from "./contract";
import { CATEGORY_RULE, categoryRule } from "./taxonomy";

describe("report taxonomy", () => {
    it("defines one rule per category in the contract order with no extras", () => {
        expect(CATEGORY_RULE.map(rule => rule.id)).toEqual([...REPORT_CATEGORY]);
        expect(new Set(CATEGORY_RULE.map(rule => rule.label)).size).toBe(REPORT_CATEGORY.length);
    });
    it("requires expected behavior only for an incorrect result", () => {
        expect(CATEGORY_RULE.filter(rule => rule.expectedRequired).map(rule => rule.id)).toEqual(["incorrect_result"]);
        expect(categoryRule("incorrect_result").expectedLabel).toBe("Expected result");
    });
    it("uses the improvement and use-case wording for suggestions", () => {
        expect(categoryRule("suggestion")).toMatchObject({ expectedLabel: "What improvement would help? (optional)", observedLabel: "Suggested use case (optional)", expectedRequired: false });
    });
    it("rejects an unknown category", () => {
        expect(() => categoryRule("nope" as never)).toThrow("Unknown report category");
    });
    it("gives every category an explanatory hint and no instruction to send files or secrets", () => {
        for (const rule of CATEGORY_RULE) {
            expect(rule.hint.length).toBeGreaterThan(10);
            expect(`${rule.hint}${rule.expectedLabel}${rule.observedLabel}`).not.toMatch(/upload|attach|screenshot|password|secret value/i);
        }
    });
});
