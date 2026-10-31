import { expect, test } from "@playwright/test";

const WORKFLOW_SLUG = ["prepare-image-for-upload", "heic-photos-to-pdf", "assemble-pdf-packet", "pdf-pages-for-slides"];

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    test(`the seven home category boards stack in one column at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto("/");
        const boardList = await page.locator("[data-home-board]").evaluateAll(node => node.map(el => {
            const rect = el.getBoundingClientRect();
            return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY, left: rect.left, width: rect.width };
        }));
        expect(boardList).toHaveLength(7);
        for (let index = 1; index < boardList.length; index += 1) {
            expect(boardList[index].top, `board ${index} below board ${index - 1}`).toBeGreaterThan(boardList[index - 1].bottom);
            expect(Math.abs(boardList[index].left - boardList[0].left)).toBeLessThanOrEqual(1);
            expect(Math.abs(boardList[index].width - boardList[0].width)).toBeLessThanOrEqual(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    test(`workflow cards are single full-area links at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto("/workflows");
        for (const slug of WORKFLOW_SLUG) {
            const item = page.locator(`[data-available-workflow="${slug}"]`);
            await expect(item.locator("a")).toHaveCount(1);
            await expect(item.locator("a")).toHaveAttribute("href", `/workflows/${slug}`);
            const hit = await item.evaluate((el) => {
                const link = el.querySelector("a")!;
                const li = el.getBoundingClientRect();
                const a = link.getBoundingClientRect();
                link.scrollIntoView({ block: "center" });
                const r = link.getBoundingClientRect();
                const topAtCorner = document.elementFromPoint(r.left + 16, r.bottom - 16);
                return { fillsItem: Math.abs(li.width - a.width) <= 1 && Math.abs(li.height - a.height) <= 1, cornerInside: !!topAtCorner && link.contains(topAtCorner) };
            });
            expect(hit.fillsItem, slug).toBe(true);
            expect(hit.cornerInside, slug).toBe(true);
        }
    });
}

test("clicking blank padding of a workflow card navigates; Tab then Enter also works", async ({ page }) => {
    await page.goto("/workflows");
    const link = page.locator(`[data-available-workflow="${WORKFLOW_SLUG[1]}"] a`);
    const box = (await link.boundingBox())!;
    await page.mouse.click(box.x + 16, box.y + box.height - 16);
    await expect(page).toHaveURL(new RegExp(`/workflows/${WORKFLOW_SLUG[1]}$`));

    await page.goto("/workflows");
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("box-shadow", /rgb/);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/workflows/${WORKFLOW_SLUG[1]}$`));
});
