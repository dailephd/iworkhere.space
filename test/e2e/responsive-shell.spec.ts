import { test, expect } from "./support/fixture";

for (const route of ["/", "/discover", "/category/text", "/tool/calculator", "/tool/time-arithmetic"]) {
    test(`responsive shell and document scrolling on ${route}`, async ({ page }, testInfo) => {
        await page.goto(route);
        const main = page.getByRole("main");
        await expect(main).toHaveCount(1);
        await expect(main).toBeVisible();
        const siteHeader = page.getByRole("banner");
        await expect(siteHeader).toBeVisible();
        await expect(siteHeader.getByText("iworkhere.space", { exact: true })).toBeVisible();
        await expect(siteHeader.getByRole("button", { name: "Themes", exact: true })).toBeVisible();
        await expect(page.getByText("Header banner", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Left banner", { exact: true })).toHaveCount(0);
        const navigation = page.getByRole("navigation", { name: "Primary navigation", exact: true });
        await expect(navigation).toBeVisible();
        const desktop = testInfo.project.name === "desktop-chromium";
        await expect(page.getByRole("complementary", { name: "Left advertising area" })).toHaveCount(0);
        const rightAdvertisingArea = page.getByRole("complementary", { name: "Right advertising area" });
        const rightBanner = page.getByText("Right banner", { exact: true });
        const footerBanner = page.getByText("Footer banner", { exact: true });
        if (desktop) {
            await expect(siteHeader.getByRole("link", { name: "Search tools", exact: true })).toBeVisible();
        }
        await expect(rightAdvertisingArea).toHaveCount(0);
        await expect(rightBanner).toHaveCount(0);
        await expect(footerBanner).toHaveCount(0);

        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", { name: "Skip to main content", exact: true });
        await expect(skip).toBeFocused();
        await expect(skip).toBeVisible();
        await skip.press("Enter");
        await expect(page).toHaveURL(/#main-content$/);
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.querySelector("main")!.contains(document.activeElement))).toBe(true);

        const geometry = await page.evaluate(() => {
            const main = document.querySelector("main")!;
            const footer = document.querySelector("footer")!;
            const grid = main.parentElement!;
            const navigation = document.querySelector('nav[aria-label="Primary navigation"]')!;
            const header = document.querySelector("header")!;
            const shell = document.querySelector("body > div:has(>header)")!;
            const style = getComputedStyle(main);
            const gridStyle = getComputedStyle(grid);
            const shellStyle = getComputedStyle(shell);
            return {
                scrollOwner: document.scrollingElement === document.documentElement,
                mainOverflowY: style.overflowY,
                shellOverflowY: shellStyle.overflowY,
                mainClientHeight: main.clientHeight,
                mainScrollHeight: main.scrollHeight,
                horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
                footerFollowsMain: footer.getBoundingClientRect().top >= main.getBoundingClientRect().bottom,
                desktopGridTrackCount: gridStyle.gridTemplateColumns.split(" ").length,
                navigationInsideHeader: header.contains(navigation),
            };
        });
        expect(geometry.scrollOwner).toBe(true);
        expect(geometry.mainOverflowY).toBe("visible");
        expect(geometry.shellOverflowY).toBe("visible");
        expect(geometry.mainScrollHeight).toBeLessThanOrEqual(geometry.mainClientHeight);
        expect(geometry.horizontalOverflow).toBe(false);
        expect(geometry.footerFollowsMain).toBe(true);
        if (desktop) {
            expect(geometry.desktopGridTrackCount).toBe(1);
            expect(geometry.navigationInsideHeader).toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(page.getByRole("contentinfo")).toBeInViewport();
        const scroll = await page.evaluate(() => ({ y: window.scrollY, maximum: document.documentElement.scrollHeight - window.innerHeight }));
        expect(scroll.y).toBeGreaterThanOrEqual(Math.max(0, scroll.maximum - 1));
        await navigation.getByRole("link", { name: "All tools", exact: true }).click();
        await expect(page).toHaveURL(/\/discover$/);
    });
}
