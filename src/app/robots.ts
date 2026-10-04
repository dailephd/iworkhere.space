import type { MetadataRoute } from "next";
import { canonicalUrl, isIndexable } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
    if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
    return { rules: { userAgent: "*", allow: "/" }, sitemap: canonicalUrl("/sitemap.xml") };
}
