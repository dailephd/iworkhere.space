import { timingSafeEqual } from "node:crypto";
import { maintainObservability, reportPersistenceFailure } from "@/module/observability/persistence.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || !authorization) return new Response(null, { status: 401 });
    const expected = Buffer.from(`Bearer ${secret}`);
    const supplied = Buffer.from(authorization);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return new Response(null, { status: 401 });
    try {
        await maintainObservability();
        return new Response(null, { status: 204 });
    } catch {
        reportPersistenceFailure("maintenance");
        return new Response(null, { status: 503 });
    }
}
