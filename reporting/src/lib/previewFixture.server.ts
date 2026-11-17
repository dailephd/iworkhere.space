import "server-only";
import { reportingModel, type ReportingResponse } from "../../../dashboard/src/lib/reportingModel";
import { resourceConfig, STYTCH_TEST_ISSUER } from "./auth.server";
import { ServiceUnavailable } from "./response";

export const FIXTURE_NOTICE = "SYNTHETIC TEST FIXTURE. Not production observability data.";

/** Explicit Test Preview only; no connection, raw events or diagnostic fixtures. */
export function previewFixtureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.REPORTING_PREVIEW_FIXTURE === undefined) return false;
    if (env.REPORTING_PREVIEW_FIXTURE !== "true" || env.VERCEL_ENV !== "preview"
        || env.REPORTING_OAUTH_PROFILE !== "stytch-test" || env.REPORTING_OAUTH_ISSUER !== STYTCH_TEST_ISSUER
        || env.REPORTING_DATABASE_URL) throw new ServiceUnavailable("configuration");
    resourceConfig(env);
    return true;
}

export async function observePreviewFixture(request: unknown): Promise<ReportingResponse> {
    if (!previewFixtureEnabled()) throw new ServiceUnavailable("configuration");
    const now = new Date("2026-10-01T12:00:00.000Z");
    // Already aggregated synthetic rows, consumed by the authoritative B1 model.
    return reportingModel(request, {
        activity: [
            { section: "total", identity: null, navigation: 12, opens: 3, executions: 2, errors: 1 },
            { section: "tool", identity: null, navigation: 0, opens: 3, executions: 2, errors: 1 },
            { section: "route", identity: "/", navigation: 12, opens: 0, executions: 0, errors: 0 },
            { section: "error", identity: "window-error", navigation: 0, opens: 0, executions: 0, errors: 1 },
        ],
        vital: [{ metric_name: "LCP", sample_count: 4, value: 1420 }],
        evidence: [{ observed_at: now.toISOString(), retained_from: "2026-07-03T00:00:00.000Z", recent_event_count: 0,
            missing_completed_days: 0, mismatched_completed_days: 0, pending_grace_days: 0, last_raw_received: null, last_rollup_day: null }],
    }, now, null);
}
