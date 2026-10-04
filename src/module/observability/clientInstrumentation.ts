import { setAnalyticProvider } from "@/module/analytics";
import { createNetworkProvider } from "@/module/analytics/networkProvider";
import { setLogProvider } from "@/module/log/logger";
import { RustLogProvider } from "@/module/log/RustLogProvider";
import { captureError } from "./index";
import { reportClientErrorMetric } from "./errorMetric.client";
import { referrerHostname, safePathname } from "./metric";
import { currentMetricContext, observabilityEnabled, sendMetric } from "./transport.client";

export function reportClientError(error: unknown, failureCategory: "window-error" | "unhandled-rejection"): void {
    reportClientErrorMetric(error, { failureCategory });
    try {
        if (observabilityEnabled()) captureError(error, { boundary: "browser", failureCategory });
    } catch { /* Never affect startup or event dispatch. */ }
}
export function reportNavigation(url: string, navigationType: "initial" | "push" | "replace" | "traverse" = "push"): void {
    try {
        if (!observabilityEnabled()) return;
        const hostname = navigationType === "initial" ? referrerHostname(document.referrer) : undefined;
        sendMetric({ type: "navigation", ...currentMetricContext(), pathname: safePathname(url), navigationType, ...(hostname ? { referrerHostname: hostname } : {}) });
    } catch { /* Fail silent. */ }
}
export function initializeClientInstrumentation(): void {
    try {
        if (!observabilityEnabled()) return;
        setAnalyticProvider(createNetworkProvider());
        setLogProvider(new RustLogProvider());
        window.addEventListener("error", event => reportClientError(event.error ?? new Error(event.message), "window-error"));
        window.addEventListener("unhandledrejection", event => reportClientError(event.reason, "unhandled-rejection"));
        reportNavigation(window.location.pathname, "initial");
    } catch { /* Instrumentation cannot prevent application startup. */ }
}
