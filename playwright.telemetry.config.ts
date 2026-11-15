import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Exercise the real production composition with transport enabled. Persistence,
// vendor analytics and ads stay disabled; the browser intercepts every metric.
if (process.env.E2E_BASE_URL) throw new Error("Telemetry tests require the isolated local production server.");

export default defineConfig({
    ...config,
    testDir: "./test/telemetry",
    webServer: {
        command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
            NEXT_PUBLIC_OBSERVABILITY_ENABLED: "true",
            NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: "false",
            NEXT_PUBLIC_ADSENSE_ENABLED: "false",
            OBSERVABILITY_PERSISTENCE_ENABLED: "false",
            OBSERVABILITY_DATABASE_URL: "",
        },
    },
});
