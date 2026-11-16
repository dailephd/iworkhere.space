import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAllTool, getAvailableCategory } from "../src/module/tool/metadata";
import { getAllOperationalWorkflow } from "../src/module/workflow/registry";

/** Build-time projection only. No UI or registry imports in the standalone reader. */
export function reportingIdentity() {
    const tool = getAllTool().map(item => ({ id: item.id, route: item.seo.canonicalPath })).sort((a, b) => a.id.localeCompare(b.id));
    function staticRoute(directory: string, segment: string[]): string[] {
        const entry = readdirSync(directory, { withFileTypes: true });
        const own = entry.some(item => item.isFile() && item.name === "page.tsx") ? ["/" + segment.join("/")] : [];
        return [...own, ...entry.filter(item => item.isDirectory() && !item.name.startsWith("[")).flatMap(item => staticRoute(path.join(directory, item.name), [...segment, item.name]))];
    }
    const route = [...new Set([...staticRoute(path.resolve("src/app"), []), ...tool.map(item => item.route),
        ...getAvailableCategory().map(id => `/category/${id}`), ...getAllOperationalWorkflow().map(item => item.canonicalPath)])].sort();
    if (tool.some(item => !/^[a-z0-9-]{1,128}$/.test(item.id)) || route.some(item => item.length > 256 || !/^\/(?:[a-zA-Z0-9/_-]*)$/.test(item) || item.startsWith("//"))) {
        throw new Error("Invalid canonical reporting identity");
    }
    return { tool, route };
}
if (process.argv.includes("--write-reporting-identity")) {
    writeFileSync("dashboard/src/lib/reportingIdentity.json", JSON.stringify(reportingIdentity(), null, 2) + "\n");
}
