"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface TurnstileApi {
    render(container: HTMLElement, options: Record<string, unknown>): string;
    reset(widgetId: string): void;
    remove(widgetId: string): void;
}
declare global {
    interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileHandle { reset(): void }
export interface TurnstileChallengeProps {
    siteKey: string;
    onToken(token: string | null): void;
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    scriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Challenge unavailable"));
        script.onerror = () => { scriptPromise = null; reject(new Error("Challenge unavailable")); };
        document.head.append(script);
    });
    return scriptPromise;
}

/** Cloudflare Turnstile widget. The token is held in memory only and is single use. */
export const TurnstileChallenge = forwardRef<TurnstileHandle, TurnstileChallengeProps>(function TurnstileChallenge({ siteKey, onToken }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const api = useRef<TurnstileApi | null>(null);
    const callback = useRef(onToken);
    useEffect(() => { callback.current = onToken; });
    useImperativeHandle(ref, () => ({
        reset() {
            callback.current(null);
            if (api.current && widget.current) api.current.reset(widget.current);
        },
    }), []);
    useEffect(() => {
        let cancelled = false;
        loadTurnstile().then(turnstile => {
            if (cancelled || !container.current) return;
            api.current = turnstile;
            widget.current = turnstile.render(container.current, {
                sitekey: siteKey,
                callback: (token: string) => callback.current(token),
                "expired-callback": () => callback.current(null),
                "error-callback": () => callback.current(null),
            });
        }).catch(() => callback.current(null));
        return () => {
            cancelled = true;
            if (api.current && widget.current) api.current.remove(widget.current);
            widget.current = null;
        };
    }, [siteKey]);
    return <div ref={container} data-testid="support-challenge" className="min-h-[65px]" />;
});
