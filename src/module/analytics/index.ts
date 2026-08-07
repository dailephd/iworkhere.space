import type { AnalyticEventName, AnalyticEventProp, AnalyticProvider } from "./type"
import { createLocalProvider } from "./provider"

let activeProvider: AnalyticProvider = createLocalProvider()

export function setAnalyticProvider(provider: AnalyticProvider): void {
    activeProvider = provider
}

export function track<E extends AnalyticEventName>(event: E, prop: AnalyticEventProp[E]): void {
    activeProvider.track(event, prop)
}

export function identify(id: string): void {
    activeProvider.identify(id)
}

export function enableAnalytic(): void {
    activeProvider.enable()
}

export function disableAnalytic(): void {
    activeProvider.disable()
}

export type { AnalyticEventName, AnalyticEventProp, AnalyticProvider } from "./type"
