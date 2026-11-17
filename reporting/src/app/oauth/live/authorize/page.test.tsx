import { afterEach, expect, it, vi } from "vitest";
import { Authorization } from "../../../../component/Authorization";
import LivePage from "./page";
import TestPage from "../../authorize/page";

afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "", "public-token-test-fixture", "invalid-fixture"])("does not initialize Live login with missing or wrong-environment config %s", token => {
    vi.stubEnv("NEXT_PUBLIC_STYTCH_LIVE_PUBLIC_TOKEN", token);
    expect(LivePage().type).toBe("main");
});
it("composes the existing SDK owner with only the Live public token", () => {
    vi.stubEnv("NEXT_PUBLIC_STYTCH_LIVE_PUBLIC_TOKEN", "public-token-live-fixture");
    vi.stubEnv("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN", "public-token-test-fixture");
    const live = LivePage(), test = TestPage();
    expect(live.type).toBe(Authorization); expect(live.key).toBe("stytch-live"); expect(live.props).toEqual({ publicToken: "public-token-live-fixture", environment: "live" });
    expect(test.type).toBe(Authorization); expect(test.props.publicToken).toBe("public-token-test-fixture");
});
it("does not use either environment's token as a fallback for the other", () => {
    vi.stubEnv("NEXT_PUBLIC_STYTCH_LIVE_PUBLIC_TOKEN", undefined); vi.stubEnv("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN", "public-token-live-fixture");
    expect(LivePage().type).toBe("main"); expect(TestPage().type).toBe("main");
});
