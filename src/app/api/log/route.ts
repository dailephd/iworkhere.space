interface LogRequestBody {
    level: string;
    message: string;
    meta?: Record<string, unknown>;
    timestamp: string;
    url?: string;
}

const VALID_LEVEL = new Set(["debug", "info", "warn", "error"]);

function isValidLogBody(body: unknown): body is LogRequestBody {
    if (typeof body !== "object" || body === null) return false;
    const obj = body as Record<string, unknown>;
    if (typeof obj.level !== "string") return false;
    if (typeof obj.message !== "string") return false;
    if (typeof obj.timestamp !== "string") return false;
    return true;
}

export async function POST(request: Request): Promise<Response> {
    try {
        const body: unknown = await request.json();

        if (!isValidLogBody(body)) {
            return new Response(null, { status: 400 });
        }

        if (!VALID_LEVEL.has(body.level)) {
            return new Response(null, { status: 400 });
        }

        const metaStr = body.meta ? ` ${JSON.stringify(body.meta)}` : "";
        console.log(
            `[CLIENT-LOG] [${body.timestamp}] [${body.level.toUpperCase()}] ${body.message}${metaStr}`,
        );

        return new Response(null, { status: 204 });
    } catch {
        return new Response(null, { status: 400 });
    }
}
