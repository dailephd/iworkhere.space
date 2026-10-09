import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout, { metadata } from "./layout";
import type { AppShellProps } from "@/component/layout/AppShell";

const { appShell } = vi.hoisted(() => ({ appShell: vi.fn() }));
const adRegionProps = ["headerBannerSlot", "leftBannerSlot", "rightBannerSlot", "footerBannerSlot"] as const;
function assertNoAdRegions(props: AppShellProps) {
    for (const name of adRegionProps) expect(props[name], name).toBeUndefined();
}

vi.mock("@/module/tool/metadata", () => ({ getAvailableCategory: () => [] }));
vi.mock("@/component/common/ThemeProvider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/component/layout/ServiceWorkerRegister", () => ({ ServiceWorkerRegister: () => null }));
vi.mock("@/component/common/WebVitals", () => ({ WebVitals: () => null }));
vi.mock("@/component/observability/VercelWebAnalytics", () => ({ VercelWebAnalytics: () => <script data-test-vercel-wrapper="true" /> }));
vi.mock("@/component/layout/AppShell", () => ({ default: (props: AppShellProps) => {
    appShell(props);
    return <><header>{props.headerBannerSlot}</header><aside>{props.leftBannerSlot}</aside><main>{props.children}</main><aside>{props.rightBannerSlot}</aside><footer>{props.footerBannerSlot}</footer></>;
} }));
vi.mock("next/script", () => ({ default: (props: { id: string; src: string }) => <script async id={props.id} src={props.src} /> }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("composes exactly one Vercel Analytics wrapper", () => {
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html.match(/data-test-vercel-wrapper=/g)).toHaveLength(1);
});

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
it("keeps root and navigation content ad-free even when the global flag is enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(appShell).toHaveBeenCalledTimes(1);
    assertNoAdRegions(appShell.mock.calls[0][0]);
    expect(html).not.toContain("google-adsense");
    expect(html).not.toContain("adsbygoogle");
    expect(html).not.toContain("Advertisement");
    expect(html).toContain("<footer></footer>");
});

it.each(adRegionProps)("the root regression assertion rejects an accidentally supplied %s", name => {
    const props: AppShellProps = { children: <h1>Workspace</h1>, [name]: <div>Accidental advertising region</div> };
    expect(() => assertNoAdRegions(props)).toThrow();
});
