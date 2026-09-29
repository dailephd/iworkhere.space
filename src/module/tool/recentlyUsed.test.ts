import { describe, test, expect, beforeEach, vi } from "vitest";

const mockStore: Record<string, unknown> = {};

vi.mock("@/lib/storage", () => ({
    storage: {
        get: (key: string) => mockStore[key] ?? null,
        set: (key: string, value: unknown) => {
            mockStore[key] = value;
        },
        remove: (key: string) => {
            delete mockStore[key];
        },
    },
}));

import { getRecentTool, recordRecentTool, clearRecentTool } from "./recentlyUsed";

beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
});

describe("getRecentTool", () => {
    test("returns empty array when nothing stored", () => {
        expect(getRecentTool()).toEqual([]);
    });

    test("returns empty array when stored value is not an array", () => {
        mockStore["recent-tool"] = "not-an-array";
        expect(getRecentTool()).toEqual([]);
    });

    test("returns stored array", () => {
        mockStore["recent-tool"] = ["slugify", "calculator"];
        expect(getRecentTool()).toEqual(["slugify", "calculator"]);
    });
});

describe("recordRecentTool", () => {
    test("adds slug to empty list", () => {
        recordRecentTool("slugify");
        expect(getRecentTool()).toEqual(["slugify"]);
    });

    test("adds slug to front of existing list", () => {
        recordRecentTool("slugify");
        recordRecentTool("calculator");
        expect(getRecentTool()).toEqual(["calculator", "slugify"]);
    });

    test("deduplicates by moving existing slug to front", () => {
        recordRecentTool("a");
        recordRecentTool("b");
        recordRecentTool("c");
        recordRecentTool("a");
        expect(getRecentTool()).toEqual(["a", "c", "b"]);
    });

    test("caps list at 10 items", () => {
        for (let i = 0; i < 15; i++) {
            recordRecentTool(`tool-${i}`);
        }
        const result = getRecentTool();
        expect(result).toHaveLength(10);
        expect(result[0]).toBe("tool-14");
        expect(result[9]).toBe("tool-5");
    });

    test("does not duplicate when recording same slug twice", () => {
        recordRecentTool("slugify");
        recordRecentTool("slugify");
        expect(getRecentTool()).toEqual(["slugify"]);
    });
});

describe("clearRecentTool", () => {
    test("removes all recent entries", () => {
        recordRecentTool("slugify");
        recordRecentTool("calculator");
        clearRecentTool();
        expect(getRecentTool()).toEqual([]);
    });

    test("does not throw when already empty", () => {
        expect(() => clearRecentTool()).not.toThrow();
    });
});
