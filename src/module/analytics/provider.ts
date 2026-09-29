import type { AnalyticProvider, AnalyticEventName, AnalyticEventProp } from "./type"
import { storage } from "@/lib/storage"

const COUNTER_KEY = "analytic_event_count"

function readCounter(): Record<string, number> {
    return storage.get<Record<string, number>>(COUNTER_KEY) ?? {}
}

function incrementCounter(event: string): void {
    const counter = readCounter()
    counter[event] = (counter[event] ?? 0) + 1
    storage.set(COUNTER_KEY, counter)
}

export function createLocalProvider(): AnalyticProvider {
    let enabled = true

    return {
        track<E extends AnalyticEventName>(event: E, prop: AnalyticEventProp[E]): void {
            if (!enabled) return
            if (process.env.NODE_ENV === "development") {
                console.log(`[analytics] ${event}`, prop)
            }
            incrementCounter(event)
        },

        identify(id: string): void {
            if (!enabled) return
            if (process.env.NODE_ENV === "development") {
                console.log(`[analytics] identify: ${id}`)
            }
        },

        enable(): void {
            enabled = true
        },

        disable(): void {
            enabled = false
        },
    }
}
