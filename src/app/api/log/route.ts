import { isSafeLogRequest } from "@/module/observability/logSafety";
import { readTelemetryBody } from "@/module/observability/metric";

export async function POST(request: Request): Promise<Response> {
    try {
        const body: unknown = await readTelemetryBody(request);
        if (!isSafeLogRequest(body)) {
            return new Response(null, { status: 400 });
        }

        console.log(JSON.stringify({ source: "application-log", ...body }));

        return new Response(null, { status: 204 });
    } catch {
        return new Response(null, { status: 400 });
    }
}
