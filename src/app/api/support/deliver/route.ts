import { handleDeliveryRequest } from "@/module/support/delivery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron invokes GET; POST is accepted for manual operator invocation with the same secret.
export async function GET(request: Request): Promise<Response> {
    return handleDeliveryRequest(request);
}

export async function POST(request: Request): Promise<Response> {
    return handleDeliveryRequest(request);
}
