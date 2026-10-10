"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ToolComponentProp } from "@/module/tool/type";
import { logEvent, captureError, trackEvent } from "@/module/observability";

export interface ToolClientFrameProp {
    toolId: string;
    ToolComponent: React.ComponentType<ToolComponentProp>;
    defaultQuery?: Record<string, string>;
}

export function ToolClientFrame(prop: ToolClientFrameProp) {
    const { toolId, ToolComponent, defaultQuery } = prop;

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Log tool opened (client-side only)
    useEffect(() => {
        logEvent("Tool opened", { toolId, pathname });
        trackEvent("tool_opened", { toolId, slug: pathname.split("/").pop() || "" });
    }, [toolId, pathname]);

    const query = useMemo(() => {
        const q: Record<string, string> = {};
        for (const [k, v] of searchParams.entries()) q[k] = v;

        // Apply defaults if missing (but do not write them to URL yet)
        if (defaultQuery) {
            for (const [k, v] of Object.entries(defaultQuery)) {
                if (q[k] == null || q[k] === "") q[k] = v;
            }
        }
        return q;
    }, [searchParams, defaultQuery]);

    const setQuery = useCallback(
        (next: Record<string, string>) => {
            logEvent("Tool execution start", { toolId });
            trackEvent("tool_executed", { toolId, slug: pathname.split("/").pop() || "" });

            try {
                const sp = new URLSearchParams(searchParams.toString());

                // remove keys not present in `next` to keep URL tidy
                for (const key of Array.from(sp.keys())) {
                    if (!(key in next)) sp.delete(key);
                }

                // set keys in `next`
                for (const [k, v] of Object.entries(next)) {
                    if (v == null || v === "") sp.delete(k);
                    else sp.set(k, v);
                }

                const qs = sp.toString();
                router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            } catch (e) {
                captureError(e, { toolId, boundary: "ToolClientFrame.setQuery" });
            }
        },
        [router, pathname, searchParams, toolId]
    );

    return <ToolComponent toolId={toolId} query={query} setQuery={setQuery} />;
}
