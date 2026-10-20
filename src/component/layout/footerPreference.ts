import { storage } from "@/lib/storage"

export type FooterState = "expanded" | "collapsed"

export const FOOTER_PREFERENCE_KEY = "footer-preference"
/** The document attribute is the single runtime representation of the footer state; CSS and React both read it. */
export const FOOTER_STATE_ATTRIBUTE = "data-footer"

/** Runs before first paint so a saved collapsed footer never flashes expanded. Any other stored value stays expanded. */
export const FOOTER_INIT_SCRIPT = `(function(){try{if(JSON.parse(localStorage.getItem("${FOOTER_PREFERENCE_KEY}"))==="collapsed")document.documentElement.setAttribute("${FOOTER_STATE_ATTRIBUTE}","collapsed")}catch(e){}})()`

const listenerSet = new Set<() => void>()

export function parseFooterState(value: unknown): FooterState {
    return value === "collapsed" ? "collapsed" : "expanded"
}

export function readFooterState(): FooterState {
    return parseFooterState(document.documentElement.getAttribute(FOOTER_STATE_ATTRIBUTE))
}

export function subscribeFooterState(listener: () => void): () => void {
    listenerSet.add(listener)
    return () => listenerSet.delete(listener)
}

function applyFooterState(next: FooterState): void {
    document.documentElement.setAttribute(FOOTER_STATE_ATTRIBUTE, next)
    listenerSet.forEach((listener) => listener())
}

/** Adopts the stored preference only when the pre-paint script did not already set the state; invalid or unavailable storage leaves the footer expanded. */
export function syncFooterStateFromStorage(): void {
    if (document.documentElement.hasAttribute(FOOTER_STATE_ATTRIBUTE)) return
    const stored = parseFooterState(storage.get<unknown>(FOOTER_PREFERENCE_KEY))
    if (stored === "collapsed") applyFooterState(stored)
}

export function writeFooterState(next: FooterState): void {
    storage.set(FOOTER_PREFERENCE_KEY, next)
    applyFooterState(next)
}
