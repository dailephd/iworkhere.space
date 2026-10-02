import type { AnalyticProvider } from "./type";
import { currentMetricContext, sendMetric } from "@/module/observability/transport.client";

export function createNetworkProvider(): AnalyticProvider {
    let enabled = true;
    return {
        track(event, prop) {
            if (!enabled) return;
            try {
                sendMetric({ type: "analytic-event", ...currentMetricContext(), event, prop: { toolId: prop.toolId, slug: prop.slug } });
            } catch { /* Invalid runtime values must also fail silently. */ }
        },
        identify() { /* No identity transport. */ },
        enable() { enabled = true; },
        disable() { enabled = false; },
    };
}
