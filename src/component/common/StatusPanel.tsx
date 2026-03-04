"use client";

import { useEffect, useState } from "react";

export interface StatusPanelProps {
    toolCount: number;
    categoryCount: number;
}

interface ViewportState {
    width: number;
    height: number;
    dpr: number;
}

export function readTheme(): string {
    const root = document.documentElement;
    const v = root.getAttribute("data-theme");
    if (v === "light" || v === "dark") return v;
    return "system";
}

export default function StatusPanel(_props: StatusPanelProps) {
    const [_theme, setTheme] = useState("system");
    const [_viewport, setViewport] = useState<ViewportState>({
        width: 0,
        height: 0,
        dpr: 1,
    });

    useEffect(() => {
        function sync() {
            setTheme(readTheme());
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
                dpr: window.devicePixelRatio || 1,
            });
        }

        sync();
        window.addEventListener("resize", sync);

        const obs = new MutationObserver(() => sync());
        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => {
            window.removeEventListener("resize", sync);
            obs.disconnect();
        };
    }, []);

    return <section aria-hidden="true" className="hidden" />;
}