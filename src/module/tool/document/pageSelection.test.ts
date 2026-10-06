import { describe, expect, it } from "vitest";
import { parsePageSelection } from "./pageSelection";
describe("page selection", () => {
    it.each([ ["1", [1]], ["1-3", [1, 2, 3]], ["1,3,5", [1, 3, 5]], ["1-3,6,9-10", [1, 2, 3, 6, 9, 10]], ["3,1-3,2,5", [3, 1, 2, 5]], [" \t1 - 3 , 6\n", [1, 2, 3, 6]] ])("expands %s preserving first occurrence", (expression, page) => {
        expect(parsePageSelection(expression as string, { maxOutputCount: 10, pageCount: 10 })).toEqual({ ok: true, page });
    });
    it.each(["", " ", "0", "-1", "5-2", "1,", ",1", "1,,2", "1-2-3", "1.5", "1e2", "+1", "1 2", "9007199254740992", "1–3", "\u00a01"]) ("rejects %s", expression => {
        expect(parsePageSelection(expression, { maxOutputCount: 20 }).ok).toBe(false);
    });
    it("enforces page count, output cap and valid options without unbounded expansion", () => {
        expect(parsePageSelection("11", { pageCount: 10, maxOutputCount: 20 })).toEqual({ ok: false, category: "page-count" });
        expect(parsePageSelection("1-999999999", { maxOutputCount: 20 })).toEqual({ ok: false, category: "output-limit" });
        expect(parsePageSelection("1,3,5", { maxOutputCount: 2 })).toEqual({ ok: false, category: "output-limit" });
        expect(parsePageSelection("1,1", { maxOutputCount: 1 })).toEqual({ ok: true, page: [1] });
        expect(parsePageSelection("1", { maxOutputCount: 0 })).toEqual({ ok: false, category: "option" });
        expect(parsePageSelection("1", { pageCount: 0, maxOutputCount: 1 })).toEqual({ ok: false, category: "option" });
    });
});
