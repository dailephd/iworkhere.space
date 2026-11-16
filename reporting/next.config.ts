import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
    outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
    async headers() { return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, { key: "Cache-Control", value: "no-store" }] }]; },
};
export default config;
