/** @vitest-environment jsdom */
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileChallenge, type TurnstileHandle } from "./TurnstileChallenge";

interface RenderOptions { sitekey: string; callback(token: string): void; "expired-callback"(): void; "error-callback"(): void }
let host: HTMLDivElement;
let root: Root;
const widget = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };
let options: RenderOptions;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    widget.render.mockImplementation((_element: HTMLElement, rendered: RenderOptions) => { options = rendered; return "widget-1"; });
    (window as unknown as { turnstile: typeof widget }).turnstile = widget;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    document.head.querySelectorAll("script").forEach(script => script.remove());
    vi.clearAllMocks(); vi.unstubAllGlobals();
});

describe("TurnstileChallenge", () => {
    it("renders the public site key and forwards single-use tokens, expiry and errors", async () => {
        const onToken = vi.fn();
        await act(async () => root.render(<TurnstileChallenge siteKey="public-site-key" onToken={onToken} />));
        await act(async () => { await Promise.resolve(); });
        expect(widget.render).toHaveBeenCalledTimes(1);
        expect(options.sitekey).toBe("public-site-key");
        options.callback("token-1");
        options["expired-callback"]();
        options["error-callback"]();
        expect(onToken.mock.calls.map(call => call[0])).toEqual(["token-1", null, null]);
    });
    it("clears the token and resets the widget on request", async () => {
        const onToken = vi.fn();
        const handle = createRef<TurnstileHandle>();
        await act(async () => root.render(<TurnstileChallenge ref={handle} siteKey="k" onToken={onToken} />));
        await act(async () => { await Promise.resolve(); });
        await act(async () => handle.current!.reset());
        expect(onToken).toHaveBeenLastCalledWith(null);
        expect(widget.reset).toHaveBeenCalledWith("widget-1");
    });
    it("removes the widget when unmounted", async () => {
        await act(async () => root.render(<TurnstileChallenge siteKey="k" onToken={() => {}} />));
        await act(async () => { await Promise.resolve(); });
        await act(async () => root.render(<div />));
        expect(widget.remove).toHaveBeenCalledWith("widget-1");
    });
    it("reports no token when the challenge script cannot load", async () => {
        delete (window as unknown as { turnstile?: unknown }).turnstile;
        const onToken = vi.fn();
        await act(async () => root.render(<TurnstileChallenge siteKey="k" onToken={onToken} />));
        const script = document.head.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
        expect(script).not.toBeNull();
        await act(async () => { script!.onerror?.(new Event("error")); await Promise.resolve(); });
        expect(onToken).toHaveBeenCalledWith(null);
        expect(widget.render).not.toHaveBeenCalled();
    });
});
