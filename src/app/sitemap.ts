import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";
import { getAllTool, getAvailableCategory } from "@/module/tool/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: canonicalUrl("/") },
        { url: canonicalUrl("/discover") },
        { url: canonicalUrl("/privacy") },
        ...getAllTool().map(tool => ({ url: canonicalUrl(tool.seo.canonicalPath) })),
        ...getAvailableCategory().map(category => ({ url: canonicalUrl(`/category/${category}`) })),
    ];
}
