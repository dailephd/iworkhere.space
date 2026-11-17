import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ session: null as object | null, isInitialized: false, fromCache: false }));
const initialize = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("@stytch/nextjs", () => ({
    createStytchUIClient: initialize, Products: { otp: "otp" },
    StytchProvider: ({ children }: { children: ReactNode }) => children,
    useStytchSession: () => state,
    IdentityProvider: () => <p>Consent screen</p>, StytchLogin: () => <p>Login screen</p>,
}));
import { Authorization } from "./Authorization";
beforeEach(() => { Object.assign(state, { session: null, isInitialized: true, fromCache: false }); initialize.mockClear(); });
const render = () => renderToStaticMarkup(<Authorization publicToken="public-token-test-fixture" />);
it("requires sign-in before rendering consent", () => {
    expect(render()).toContain("Login screen"); expect(render()).not.toContain("Consent screen");
    expect(initialize).toHaveBeenCalledWith("public-token-test-fixture", undefined);
    state.session = {}; expect(render()).toContain("Consent screen");
});
it("does not authorize consent from a cached or uninitialized session", () => {
    state.session = {}; state.fromCache = true; expect(render()).not.toContain("Consent screen");
    state.fromCache = false; state.isInitialized = false; expect(render()).not.toContain("Consent screen");
});
it("labels Live login without changing the mandatory session initialization checks", () => {
    state.session = {}; state.fromCache = true;
    const html = renderToStaticMarkup(<Authorization publicToken="public-token-live-fixture" environment="live" customBaseUrl="https://eminent-plume-9461.customers.stytch.com" />);
    expect(html).toContain("Stytch Live sign-in"); expect(html).not.toContain("Consent screen");
    expect(initialize).toHaveBeenCalledWith("public-token-live-fixture", { customBaseUrl: "https://eminent-plume-9461.customers.stytch.com", cookieOptions: {
        opaqueTokenCookieName: "iworkhere_live_stytch_session", jwtCookieName: "iworkhere_live_stytch_session_jwt",
        istCookieName: "iworkhere_live_stytch_intermediate", path: "/oauth/live",
    } });
});
