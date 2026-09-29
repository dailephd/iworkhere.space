import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * We test the StorageAdapter logic by re-importing the module
 * under different conditions (with and without window/localStorage).
 */

describe("storage adapter", () => {
    let storage: typeof import("./storage")["storage"]

    describe("with localStorage available", () => {
        const mockStore: Record<string, string> = {}

        beforeEach(async () => {
            // Clear mock store
            for (const key of Object.keys(mockStore)) {
                delete mockStore[key]
            }

            // Mock localStorage on globalThis
            const localStorageMock = {
                getItem: vi.fn((key: string) => mockStore[key] ?? null),
                setItem: vi.fn((key: string, value: string) => {
                    mockStore[key] = value
                }),
                removeItem: vi.fn((key: string) => {
                    delete mockStore[key]
                }),
            }

            vi.stubGlobal("window", {})
            vi.stubGlobal("localStorage", localStorageMock)

            // Re-import to pick up the mocked globals
            const mod = await import("./storage")
            storage = mod.storage
        })

        it("returns null for missing key", () => {
            expect(storage.get("nonexistent")).toBeNull()
        })

        it("sets and gets a string value", () => {
            storage.set("key1", "hello")
            expect(storage.get<string>("key1")).toBe("hello")
        })

        it("sets and gets a number value", () => {
            storage.set("num", 42)
            expect(storage.get<number>("num")).toBe(42)
        })

        it("sets and gets an object value", () => {
            const obj = { a: 1, b: "two" }
            storage.set("obj", obj)
            expect(storage.get<typeof obj>("obj")).toEqual(obj)
        })

        it("sets and gets an array value", () => {
            const arr = [1, 2, 3]
            storage.set("arr", arr)
            expect(storage.get<number[]>("arr")).toEqual([1, 2, 3])
        })

        it("overwrites existing value", () => {
            storage.set("key", "first")
            storage.set("key", "second")
            expect(storage.get<string>("key")).toBe("second")
        })

        it("removes a key", () => {
            storage.set("key", "value")
            storage.remove("key")
            expect(storage.get("key")).toBeNull()
        })

        it("remove on missing key does not throw", () => {
            expect(() => storage.remove("nonexistent")).not.toThrow()
        })

        it("returns null for invalid JSON in storage", () => {
            mockStore["bad"] = "not-valid-json{"
            expect(storage.get("bad")).toBeNull()
        })
    })

    describe("SSR safety (no window)", () => {
        beforeEach(async () => {
            vi.stubGlobal("window", undefined)
            vi.unstubAllGlobals()

            // Remove window to simulate SSR
            const originalWindow = globalThis.window
            // @ts-expect-error - deliberately removing window for SSR test
            delete globalThis.window

            const mod = await import("./storage")
            storage = mod.storage

            // Cleanup will restore
            if (originalWindow !== undefined) {
                globalThis.window = originalWindow
            }
        })

        it("get returns null without window", () => {
            expect(storage.get("anything")).toBeNull()
        })

        it("set does not throw without window", () => {
            expect(() => storage.set("key", "value")).not.toThrow()
        })

        it("remove does not throw without window", () => {
            expect(() => storage.remove("key")).not.toThrow()
        })
    })
})
