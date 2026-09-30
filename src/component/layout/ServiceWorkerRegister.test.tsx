/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

let host: HTMLDivElement;
let root: Root;

describe("ServiceWorkerRegister", () => {
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it.each(["development", "test"])("does not register in %s", async environment => {
        vi.stubEnv("NODE_ENV", environment);
        const register = vi.fn().mockResolvedValue({});
        vi.stubGlobal("navigator", { serviceWorker: { register } });
        await act(async () => root.render(createElement(ServiceWorkerRegister)));
        expect(register).not.toHaveBeenCalled();
    });

    it("does not register when the production browser lacks service worker support", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubGlobal("navigator", {});
        await act(async () => root.render(createElement(ServiceWorkerRegister)));
        expect(host.innerHTML).toBe("");
    });

    it("registers exactly /sw.js in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const register = vi.fn().mockResolvedValue({});
        vi.stubGlobal("navigator", { serviceWorker: { register } });
        await act(async () => root.render(createElement(ServiceWorkerRegister)));
        expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js");
    });

    it("handles registration rejection without rejecting the component effect", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const register = vi.fn().mockRejectedValue(new Error("Registration unavailable"));
        vi.stubGlobal("navigator", { serviceWorker: { register } });
        await act(async () => root.render(createElement(ServiceWorkerRegister)));
        expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js");
        expect(host.innerHTML).toBe("");
    });
});
