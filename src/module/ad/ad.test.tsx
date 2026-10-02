import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ADSENSE_CLIENT, ADSENSE_SLOT, ADSENSE_SCRIPT, ADS_TXT, adsenseEnabled } from "./config";
import { initializeAdSlot } from "./runtime.client";
import { AdSenseSlot } from "@/component/common/AdSenseSlot";
import { AdSenseScript } from "@/component/common/AdSenseScript";
import { captureError } from "@/module/observability";

vi.mock("@/module/observability", () => ({ captureError: vi.fn() }));
vi.mock("next/script", () => ({ default: (props: { id: string; src: string; crossOrigin: "anonymous"; strategy: string }) => <script async id={props.id} src={props.src} crossOrigin={props.crossOrigin} data-strategy={props.strategy} /> }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const enable = () => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true"); };
describe("centralized AdSense", () => {
    it("has exact public identities and ads.txt", () => {
        expect(ADSENSE_CLIENT).toBe("ca-pub-7976885058339852");
        expect(ADSENSE_SLOT).toEqual({ header: "4100977160", right: "2496999884" });
        expect(readFileSync("public/ads.txt", "utf8")).toBe(ADS_TXT);
        expect(ADS_TXT).toBe("google.com, pub-7976885058339852, DIRECT, f08c47fec0942fa0\n");
    });
    it.each([undefined, "false", "TRUE", "1"])("disabled for flag %s", flag => expect(adsenseEnabled(flag, "production")).toBe(false));
    it("production is required in addition to explicit true", () => {
        expect(adsenseEnabled("true", "development")).toBe(false);
        expect(adsenseEnabled("true", "test")).toBe(false);
        expect(adsenseEnabled("true", "production")).toBe(true);
    });
    it("renders no script, slot, label or empty placeholder when disabled", () => {
        vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
        expect(renderToStaticMarkup(<><AdSenseScript /><AdSenseSlot placement="header" /><AdSenseSlot placement="right" /></>)).toBe("");
    });
    it("renders one nonblocking global script and the two correct slots", () => {
        enable();
        const html = renderToStaticMarkup(<><AdSenseScript /><AdSenseSlot placement="header" /><AdSenseSlot placement="right" /></>);
        expect(html.match(/id="google-adsense"/g)).toHaveLength(1);
        expect(html).toContain(ADSENSE_SCRIPT.replace(/&/g, "&amp;"));
        expect(html).toContain('crossorigin="anonymous"');
        expect(html).toContain('data-strategy="afterInteractive"');
        expect(html).toContain('data-ad-slot="4100977160"');
        expect(html).toContain('data-ad-slot="2496999884"');
        expect(html).toContain('data-ad-format="horizontal"');
        expect(html).toContain('data-ad-format="vertical"');
        expect(html).toContain('data-full-width-responsive="true"');
        expect(html).toContain("min-h-[100px] sm:min-h-[90px]");
        expect(html).not.toContain("overflow-hidden");
        expect(html).not.toContain("max-h-");
    });
    it("deduplicates initialization, waits for a visible width, and honors disabled ads", () => {
        const push = vi.fn();
        vi.stubGlobal("window", { adsbygoogle: { push } });
        const element = { getAttribute: () => null, getBoundingClientRect: () => ({ width: 160 }) } as unknown as HTMLElement;
        initializeAdSlot(element, "right");
        expect(push).not.toHaveBeenCalled();
        enable();
        const hidden = { getAttribute: () => null, getBoundingClientRect: () => ({ width: 0 }) } as unknown as HTMLElement;
        initializeAdSlot(hidden, "right");
        expect(push).not.toHaveBeenCalled();
        initializeAdSlot(element, "right"); initializeAdSlot(element, "right");
        expect(push).toHaveBeenCalledTimes(1);
        expect(push).toHaveBeenCalledWith({});
    });
    it("failed initialization and logging cannot crash rendering", () => {
        enable();
        vi.stubGlobal("window", { adsbygoogle: { push() { throw new Error("blocked"); } } });
        const element = { getAttribute: () => null, getBoundingClientRect: () => ({ width: 160 }) } as unknown as HTMLElement;
        expect(() => initializeAdSlot(element, "header")).not.toThrow();
        expect(captureError).toHaveBeenCalledWith(expect.any(Error), { boundary: "AdSenseSlot", failureCategory: "ad-initialization", placement: "header" });
        vi.mocked(captureError).mockImplementationOnce(() => { throw new Error("logger failed"); });
        expect(() => initializeAdSlot({ ...element }, "header")).not.toThrow();
    });
});
