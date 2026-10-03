import type { NextConfig } from "next";

const config: NextConfig = {
    turbopack: { root: __dirname },
    async headers() {
        return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
    },
};
export default config;
