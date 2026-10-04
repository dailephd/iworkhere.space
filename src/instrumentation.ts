import type { Instrumentation } from "next/dist/server/instrumentation/types";
import { createErrorDiagnostic, serializeDiagnosticError } from "@/module/observability/diagnostic";
import { diagnosticText } from "@/module/observability/diagnosticText";
import { safePathname } from "@/module/observability/metric";
import { reportDiagnostic } from "@/module/observability/diagnostic.server";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
    try {
        const requestId = request.headers["x-vercel-id"];
        const diagnostic = await createErrorDiagnostic(serializeDiagnosticError(error), {
            pathname: safePathname(request.path),
            failureCategory: "server-request-error",
            method: diagnosticText(request.method, 16),
            routerKind: context.routerKind,
            routePath: diagnosticText(context.routePath.split(/[?#]/, 1)[0], 256),
            routeType: context.routeType,
            ...(context.renderSource ? { renderSource: context.renderSource } : {}),
            ...(context.revalidateReason ? { revalidateReason: context.revalidateReason } : {}),
            runtime: process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs",
            ...(typeof requestId === "string" && /^[a-zA-Z0-9:._-]{1,256}$/.test(requestId) ? { requestId } : {}),
        }, "server");
        await reportDiagnostic(diagnostic);
    } catch { /* The Next error path remains fail-safe, including persistence outages. */ }
};
