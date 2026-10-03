import { captureError } from "@/module/observability";
import { adsenseEnabled, type AdPlacement } from "./config";

declare global { interface Window { adsbygoogle?: object[] } }
const initialized = new WeakSet<HTMLElement>();
export function initializeAdSlot(element: HTMLElement, placement: AdPlacement): void {
    try {
        if (!adsenseEnabled() || typeof window === "undefined") return;
        if (initialized.has(element) || element.getAttribute("data-adsbygoogle-status") || element.getBoundingClientRect().width === 0) return;
        initialized.add(element);
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
        try { captureError(error, { boundary: "AdSenseSlot", failureCategory: "ad-initialization", placement }); } catch { /* Ads cannot break rendering. */ }
    }
}
