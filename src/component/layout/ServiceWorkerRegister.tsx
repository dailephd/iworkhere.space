"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        // Do not register service worker in development
        if (process.env.NODE_ENV !== "production") return;

        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker.register("/sw.js").catch(() => {
            // Fail silently — SW registration is non-critical
        });
    }, []);

    return null;
}