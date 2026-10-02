import { isMetricRequest, readTelemetryBody } from "@/module/observability/metric";
import { persistMetric, persistenceEnabled, reportPersistenceFailure, sameOriginMetricRequest } from "@/module/observability/persistence.server";

export async function POST(request: Request): Promise<Response> {
    if (!sameOriginMetricRequest(request)) return new Response(null, { status: 403 });
    try {
        const body = await readTelemetryBody(request);
        if (!isMetricRequest(body)) return new Response(null, { status: 400 });
        console.log(JSON.stringify({ source: "application-metric", ...body }));
        if (persistenceEnabled()) {
            try { await persistMetric(body); }
            catch {
                reportPersistenceFailure("insert");
                return new Response(null, { status: 503 });
            }
        }
        return new Response(null, { status: 204 });
    } catch { return new Response(null, { status: 400 }); }
}
