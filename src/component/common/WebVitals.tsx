"use client";

import { useReportWebVitals } from "next/web-vitals";
import { currentMetricContext, sendMetric } from "@/module/observability/transport.client";

type WebVital = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];
// Module-scoped callback preserves subscription identity across renders.
export function reportWebVital(metric: WebVital): void {
    sendMetric({
        type: "web-vital", ...currentMetricContext(), name: metric.name,
        value: metric.value, delta: metric.delta, id: metric.id,
        ...(metric.rating ? { rating: metric.rating } : {}),
        ...(metric.navigationType ? { navigationType: metric.navigationType } : {}),
    }, true);
}
export function WebVitals() {
    useReportWebVitals(reportWebVital);
    return null;
}
