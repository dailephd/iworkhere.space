import { isSafeLogRequest } from "@/module/observability/logSafety";
import { readTelemetryBody } from "@/module/observability/metric";
import { MAX_DIAGNOSTIC_BYTES } from "@/module/observability/diagnostic";
import { diagnosticText } from "@/module/observability/diagnosticText";
import { reportDiagnostic } from "@/module/observability/diagnostic.server";
import { sameOriginMetricRequest } from "@/module/observability/persistence.server";

export async function POST(request: Request): Promise<Response> {
    if (!sameOriginMetricRequest(request)) return new Response(null, { status: 403 });
    try {
        const body: unknown = await readTelemetryBody(request, MAX_DIAGNOSTIC_BYTES);
        if (!isSafeLogRequest(body)) {
            return new Response(null, { status: 400 });
        }

        if (body.diagnostic) await reportDiagnostic(body.diagnostic);
        else {
            const line = JSON.stringify({ source: "application-log", ...body, message: diagnosticText(body.message, 4096) });
            if (body.level === "error") console.error(line);
            else if (body.level === "warn") console.warn(line);
            else console.log(line);
        }

        return new Response(null, { status: 204 });
    } catch {
        return new Response(null, { status: 400 });
    }
}
