import { describe, it, expect, beforeEach, vi } from "vitest"
import {
    track,
    identify,
    enableAnalytic,
    disableAnalytic,
    setAnalyticProvider,
} from "./index"
import type { AnalyticProvider } from "./type"
import { createLocalProvider } from "./provider"

describe("analytics public API", () => {
    beforeEach(() => {
        // Reset to fresh local provider before each test
        setAnalyticProvider(createLocalProvider())
    })

    describe("track", () => {
        it("calls provider track with event and prop", () => {
            const mockProvider: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            setAnalyticProvider(mockProvider)

            track("tool_opened", { toolId: "slugify", slug: "slugify" })

            expect(mockProvider.track).toHaveBeenCalledWith("tool_opened", {
                toolId: "slugify",
                slug: "slugify",
            })
        })

        it("supports all defined event names", () => {
            const mockProvider: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            setAnalyticProvider(mockProvider)

            track("tool_opened", { toolId: "t", slug: "s" })
            track("tool_executed", { toolId: "t", slug: "s" })
            track("tool_result_copied", { toolId: "t", slug: "s" })
            track("tool_mode_changed", { toolId: "t", slug: "s", mode: "m" })

            expect(mockProvider.track).toHaveBeenCalledTimes(4)
        })
    })

    describe("identify", () => {
        it("calls provider identify", () => {
            const mockProvider: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            setAnalyticProvider(mockProvider)

            identify("user-123")

            expect(mockProvider.identify).toHaveBeenCalledWith("user-123")
        })
    })

    describe("enable / disable", () => {
        it("delegates to provider enable", () => {
            const mockProvider: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            setAnalyticProvider(mockProvider)

            enableAnalytic()
            expect(mockProvider.enable).toHaveBeenCalled()
        })

        it("delegates to provider disable", () => {
            const mockProvider: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            setAnalyticProvider(mockProvider)

            disableAnalytic()
            expect(mockProvider.disable).toHaveBeenCalled()
        })
    })

    describe("setAnalyticProvider", () => {
        it("swaps the active provider", () => {
            const providerA: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }
            const providerB: AnalyticProvider = {
                track: vi.fn(),
                identify: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
            }

            setAnalyticProvider(providerA)
            track("tool_opened", { toolId: "t", slug: "s" })
            expect(providerA.track).toHaveBeenCalledTimes(1)
            expect(providerB.track).toHaveBeenCalledTimes(0)

            setAnalyticProvider(providerB)
            track("tool_opened", { toolId: "t", slug: "s" })
            expect(providerA.track).toHaveBeenCalledTimes(1)
            expect(providerB.track).toHaveBeenCalledTimes(1)
        })
    })
})

describe("local analytics provider", () => {
    let provider: AnalyticProvider

    beforeEach(() => {
        // Mock localStorage for provider counter
        const mockStore: Record<string, string> = {}
        vi.stubGlobal("window", {})
        vi.stubGlobal("localStorage", {
            getItem: vi.fn((key: string) => mockStore[key] ?? null),
            setItem: vi.fn((key: string, value: string) => {
                mockStore[key] = value
            }),
            removeItem: vi.fn((key: string) => {
                delete mockStore[key]
            }),
        })

        provider = createLocalProvider()
    })

    it("track does not throw", () => {
        expect(() =>
            provider.track("tool_opened", { toolId: "t", slug: "s" }),
        ).not.toThrow()
    })

    it("identify does not throw", () => {
        expect(() => provider.identify("user-1")).not.toThrow()
    })

    it("disable stops tracking", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
        provider.disable()
        provider.track("tool_opened", { toolId: "t", slug: "s" })
        // After disable, nothing should be logged
        expect(consoleSpy).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it("enable resumes tracking after disable", () => {
        provider.disable()
        provider.enable()
        // Should not throw after re-enable
        expect(() =>
            provider.track("tool_opened", { toolId: "t", slug: "s" }),
        ).not.toThrow()
    })
})
