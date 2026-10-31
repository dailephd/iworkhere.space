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

const { availableCategory } = vi.hoisted(() => ({ availableCategory: vi.fn((): string[] => []) }));
vi.mock("next/font/google", () => ({ DM_Sans: () => ({ variable: "site-font-dm-sans-test" }) }));
vi.mock("@/module/tool/metadata", () => ({ getAvailableCategory: availableCategory }));
vi.mock("@/component/common/ThemeProvider", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
const { coordinator } = vi.hoisted(() => ({ coordinator: vi.fn() }));
vi.mock("@/module/support/SupportCoordinator", () => ({ SupportCoordinator: (props: unknown) => { coordinator(props); return <button type="button">Report a problem or suggestion</button>; } }));
vi.mock("@/module/support/projection", () => ({ contextSource: () => ({ tool: [{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }], category: ["document"] }) }));
vi.mock("@/component/layout/ServiceWorkerRegister", () => ({ ServiceWorkerRegister: () => null }));
vi.mock("@/component/common/WebVitals", () => ({ WebVitals: () => null }));
vi.mock("@/component/observability/VercelWebAnalytics", () => ({ VercelWebAnalytics: () => <script data-test-vercel-wrapper="true" /> }));
vi.mock("@/component/layout/AppShell", () => ({ default: (props: AppShellProps) => {
    appShell(props);
    return <><header>{props.headerBannerSlot}</header><aside>{props.leftBannerSlot}</aside><main>{props.children}</main><aside>{props.rightBannerSlot}</aside><footer>{props.footerBannerSlot}{props.footerActionSlot}</footer></>;
} }));
vi.mock("next/script", () => ({ default: (props: { id: string; src: string }) => <script async id={props.id} src={props.src} /> }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("composes exactly one Vercel Analytics wrapper", () => {
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html.match(/data-test-vercel-wrapper=/g)).toHaveLength(1);
    expect(html).not.toContain("Hide footer");
    expect(html).not.toContain("Show footer");
});

it("orders the four primary destinations as Home, All tools, Workflows, Guides with no About and no category links", () => {
    availableCategory.mockReturnValueOnce(["document", "image"]);
    renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    const navItem = (appShell.mock.calls[0][0] as AppShellProps).navItem!;
    expect(navItem.map(item => item.href)).toEqual(["/", "/discover", "/workflows", "/guide"]);
    expect(navItem.map(item => item.label)).toEqual(["Home", "All tools", "Workflows", "Guides"]);
    expect(navItem.some(item => item.href === "/about")).toBe(false);
    expect(navItem.filter(item => item.href === "/discover")).toHaveLength(1);
});

it("derives the separate category destinations from the registry with canonical titles", () => {
    availableCategory.mockReturnValueOnce(["document", "converter", "developer"]);
    renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    const categoryNavItem = (appShell.mock.calls[0][0] as AppShellProps).categoryNavItem!;
    expect(categoryNavItem.map(item => item.href)).toEqual(["/category/document", "/category/converter", "/category/developer"]);
    expect(categoryNavItem.map(item => item.label)).toEqual(["PDF Tools", "Converters", "Developer Tools"]);
});

it("uses the descriptive browser title for the root default metadata", () => {
    expect(metadata.title).toBe("Browser Tools for PDFs, Images and Text - iworkhere");
});

it("always exposes the exact verification metadata", () => {
    expect(metadata.other).toEqual({ "google-adsense-account": "ca-pub-7976885058339852" });
    expect(metadata.manifest).toBe("/manifest.webmanifest");
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

it("composes no reporting entry unless the public support flag is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_ENABLED", "false");
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html).not.toContain("Report a problem or suggestion");
    expect(coordinator).not.toHaveBeenCalled();
    expect(appShell.mock.calls[0][0].footerActionSlot).toBeUndefined();
});
it("composes exactly one reporting entry in the footer slot with a serializable registry projection only", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_TURNSTILE_SITE_KEY", "public-site-key");
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    expect(html.match(/Report a problem or suggestion/g)).toHaveLength(1);
    expect(html).not.toContain("Hide footer");
    expect(html).not.toContain("Show footer");
    expect(coordinator).toHaveBeenCalledTimes(1);
    const props = coordinator.mock.calls[0][0] as { source: { tool: unknown[]; category: string[] }; siteKey: string };
    expect(props.siteKey).toBe("public-site-key");
    expect(props.source.tool).toEqual([{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }]);
    expect(JSON.parse(JSON.stringify(props))).toEqual(props);
    assertNoAdRegions(appShell.mock.calls[0][0]);
});

it("applies the self-hosted DM Sans variable class to the root html element and keeps the appearance attributes", () => {
    const html = renderToStaticMarkup(<RootLayout><h1>Workspace</h1></RootLayout>);
    const root = html.match(/<html[^>]*>/)![0];
    expect(root).toContain("site-font-dm-sans-test");
    expect(root).toContain("data-palette=");
    expect(root).toContain("data-theme=");
    expect(html).not.toContain("fonts.googleapis.com");
});
