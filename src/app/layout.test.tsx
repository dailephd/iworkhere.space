import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout, { metadata } from "./layout";

vi.mock("@/module/tool/metadata", () => ({ getAvailableCategory: () => [] }));
vi.mock("@/component/common/ThemeProvider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/component/layout/ServiceWorkerRegister", () => ({ ServiceWorkerRegister: () => null }));
vi.mock("@/component/common/WebVitals", () => ({ WebVitals: () => null }));
vi.mock("@/component/layout/AppShell", () => ({ default: ({ headerBannerSlot, rightBannerSlot, footerBannerSlot, children }: { headerBannerSlot?: ReactNode; rightBannerSlot?: ReactNode; footerBannerSlot?: ReactNode; children: ReactNode }) => <><header>{headerBannerSlot}</header><main>{children}</main><aside>{rightBannerSlot}</aside><footer>{footerBannerSlot}</footer></> }));
vi.mock("next/script", () => ({ default: (props: { id: string; src: string }) => <script async id={props.id} src={props.src} /> }));
afterEach(() => { vi.unstubAllEnvs(); });

it("always exposes the exact verification metadata", () => {
    expect(metadata.other).toEqual({ "google-adsense-account": "ca-pub-7976885058339852" });
});
it("disabled root supplies no advertisement or footer placeholder", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html).not.toContain("adsbygoogle");
    expect(html).not.toContain("Footer banner");
    expect(html).not.toContain("Right banner");
    expect(html).toContain("Workspace");
});
it("enabled root composes one script and exactly the supplied top/right slots", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html.match(/id="google-adsense"/g)).toHaveLength(1);
    expect(html.match(/data-ad-slot=/g)).toHaveLength(2);
    expect(html).toContain('data-ad-slot="4100977160"');
    expect(html).toContain('data-ad-slot="2496999884"');
    expect(html.indexOf('data-ad-slot="4100977160"')).toBeLessThan(html.indexOf("Workspace"));
    expect(html.indexOf('data-ad-slot="2496999884"')).toBeGreaterThan(html.indexOf("Workspace"));
    expect(html).toContain("<footer></footer>");
});
