import { handleContactRequest } from "@/module/contact/handler.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
    return handleContactRequest(request);
}
