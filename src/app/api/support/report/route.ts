import { defaultSubmissionDependency } from "@/module/support/dependency.server";
import { handleReportRequest } from "@/module/support/submission.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
    return handleReportRequest(request, defaultSubmissionDependency());
}
