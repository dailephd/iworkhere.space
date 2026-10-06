"use client";

import { Analytics } from "@vercel/analytics/next";
import { sanitizeVercelPageView, vercelWebAnalyticsEnabled } from "@/module/analytics/vercelWebAnalytics.client";

export function VercelWebAnalytics() {
    if (!vercelWebAnalyticsEnabled()) return null;
    return <Analytics beforeSend={sanitizeVercelPageView} />;
}
