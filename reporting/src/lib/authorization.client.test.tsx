import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ session: null as object | null, isInitialized: false, fromCache: false }));
vi.mock("@stytch/nextjs", () => ({
    createStytchUIClient: () => ({}), Products: { otp: "otp" },
    StytchProvider: ({ children }: { children: ReactNode }) => children,
    useStytchSession: () => state,
    IdentityProvider: () => <p>Consent screen</p>, StytchLogin: () => <p>Login screen</p>,
}));
import { Authorization } from "./authorization.client";
beforeEach(() => Object.assign(state, { session: null, isInitialized: true, fromCache: false }));
const render = () => renderToStaticMarkup(<Authorization publicToken="public-token-test-fixture" />);
it("requires sign-in before rendering consent", () => {
    expect(render()).toContain("Login screen"); expect(render()).not.toContain("Consent screen");
    state.session = {}; expect(render()).toContain("Consent screen");
});
it("does not authorize consent from a cached or uninitialized session", () => {
    state.session = {}; state.fromCache = true; expect(render()).not.toContain("Consent screen");
    state.fromCache = false; state.isInitialized = false; expect(render()).not.toContain("Consent screen");
});
