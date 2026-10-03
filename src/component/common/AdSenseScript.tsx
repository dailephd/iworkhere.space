"use client";

import Script from "next/script";
import { ADSENSE_SCRIPT, adsenseEnabled } from "@/module/ad/config";
import { captureError } from "@/module/observability";

export function AdSenseScript() {
    if (!adsenseEnabled()) return null;
    return <Script id="google-adsense" src={ADSENSE_SCRIPT} crossOrigin="anonymous" strategy="afterInteractive"
        onError={() => {
            try { captureError(new Error("Ad script failed"), { boundary: "AdSenseScript", failureCategory: "ad-script" }); }
            catch { /* An unavailable logger cannot break script error handling. */ }
        }} />;
}
