import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";
import type { SupportContextSource } from "./context";
import type { SupportToolProjection } from "./contract";

/** The registry is the only tool-identity source; only id, slug and name are projected. */
export function toolProjection(): SupportToolProjection[] {
    return getAllTool().map(tool => ({ id: tool.id, slug: tool.slug, name: tool.name }));
}

/** Serializable context supplied to the client coordinator and used again for server validation. */
export function contextSource(): SupportContextSource {
    return { tool: toolProjection(), category: getAvailableCategory() };
}
