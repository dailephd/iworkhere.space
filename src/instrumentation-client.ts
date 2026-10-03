import { initializeClientInstrumentation, reportNavigation } from "@/module/observability/clientInstrumentation";

initializeClientInstrumentation();

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse"): void {
    reportNavigation(url, navigationType);
}
