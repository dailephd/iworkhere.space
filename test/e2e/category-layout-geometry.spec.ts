import { tool_category_definition_list } from "../../src/module/tool/category";
import { test, expect } from "./support/fixture";

interface RegisteredToolLink {
    href: string;
    category: string;
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SectionGeometry {
    id: string;
    rect: Rect;
    heading: Rect;
}

interface CardGeometry {
    href: string;
    category: string;
    sectionId: string | null;
    tabIndex: number;
    visible: boolean;
    rect: Rect;
}

interface HomeGeometry {
    sections: SectionGeometry[];
    cards: CardGeometry[];
    horizontalDocumentWidth: number;
    viewportWidth: number;
}

const categorySectionId = (category: string) => `home-category-${category}-title`;

function orderedToolsByCategory(tools: RegisteredToolLink[], categories: string[]): RegisteredToolLink[] {
    return categories.flatMap(category => tools.filter(tool => tool.category === category));
}

function intersectsByMoreThanOnePixel(first: Rect, second: Rect): boolean {
    const width = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
    const height = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
    return width > 1 && height > 1;
}

async function readHomeGeometry(page: import("@playwright/test").Page): Promise<HomeGeometry> {
    return page.evaluate(() => {
        const rect = (element: Element): Rect => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
        };
        const sections = [...document.querySelectorAll<HTMLElement>('main [data-surface="section-island"]')]
            .map(section => {
                const heading = section.querySelector("h2");
                if (!heading) throw new Error("A category section has no heading");
                return {
                    id: section.getAttribute("aria-labelledby") ?? "",
                    rect: rect(section),
                    heading: rect(heading),
                };
            });
        const cards = [...document.querySelectorAll<HTMLAnchorElement>('main a.catalog-card[href^="/tool/"]')]
            .map(card => {
                const style = getComputedStyle(card);
                return {
                    href: card.getAttribute("href") ?? "",
                    category: card.getAttribute("data-category") ?? "",
                    sectionId: card.closest<HTMLElement>('[data-surface="section-island"]')?.getAttribute("aria-labelledby") ?? null,
                    tabIndex: card.tabIndex,
                    visible: card.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0,
                    rect: rect(card),
                };
            });
        return {
            sections,
            cards,
            horizontalDocumentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            viewportWidth: window.innerWidth,
        };
    });
}

async function expectHomeLayout(
    page: import("@playwright/test").Page,
    registeredTools: RegisteredToolLink[],
    populatedCategories: string[],
): Promise<void> {
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(navigation).toBeVisible();
    const navigationRect = await navigation.boundingBox();
    expect(navigationRect).not.toBeNull();
    expect(navigationRect!.x).toBeGreaterThanOrEqual(-1);
    expect(navigationRect!.x + navigationRect!.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1);
    const navigationCategories = await navigation.locator('a[href^="/category/"]').evaluateAll(links =>
        links.map(link => new URL((link as HTMLAnchorElement).href).pathname.split("/").pop()),
    );
    expect(navigationCategories).toEqual(populatedCategories);

    const geometry = await readHomeGeometry(page);
    expect(geometry.sections.map(section => section.id)).toEqual(populatedCategories.map(categorySectionId));
    expect(geometry.sections.every(section => section.rect.width > 0 && section.rect.height > 0)).toBe(true);
    expect(geometry.cards).toHaveLength(registeredTools.length);

    const expectedCards = orderedToolsByCategory(registeredTools, populatedCategories).map(tool => ({
        href: tool.href,
        category: tool.category,
        sectionId: categorySectionId(tool.category),
    }));
    expect(new Set(geometry.cards.map(card => card.href)).size).toBe(registeredTools.length);
    expect(geometry.cards.map(({ href, category, sectionId }) => ({ href, category, sectionId }))).toEqual(expectedCards);
    expect(geometry.cards.every(card => card.visible && card.tabIndex >= 0 && card.rect.width > 0 && card.rect.height > 0)).toBe(true);

    expect(geometry.horizontalDocumentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    const sectionPairs = geometry.sections.flatMap((section, index) =>
        geometry.sections.slice(index + 1).map(other => [section, other] as const),
    );
    expect(sectionPairs).toHaveLength((geometry.sections.length * (geometry.sections.length - 1)) / 2);
    for (const [first, second] of sectionPairs) {
        expect(intersectsByMoreThanOnePixel(first.rect, second.rect), `${first.id} overlaps ${second.id}`).toBe(false);
    }

    const cardPairs = geometry.cards.flatMap((card, index) =>
        geometry.cards.slice(index + 1).map(other => [card, other] as const),
    );
    expect(cardPairs).toHaveLength((registeredTools.length * (registeredTools.length - 1)) / 2);
    for (const [first, second] of cardPairs) {
        expect(intersectsByMoreThanOnePixel(first.rect, second.rect), `${first.href} overlaps ${second.href}`).toBe(false);
    }

    const sectionsById = new Map(geometry.sections.map(section => [section.id, section]));
    for (const card of geometry.cards) {
        const section = sectionsById.get(card.sectionId ?? "");
        expect(section, `${card.href} has an owning category section`).toBeDefined();
        expect(card.rect.x, `${card.href} stays within its section's left edge`).toBeGreaterThanOrEqual(section!.rect.x - 1);
        expect(card.rect.x + card.rect.width, `${card.href} stays within its section's right edge`).toBeLessThanOrEqual(section!.rect.x + section!.rect.width + 1);
        expect(card.rect.y, `${card.href} stays within its section's top edge`).toBeGreaterThanOrEqual(section!.rect.y - 1);
        expect(card.rect.y + card.rect.height, `${card.href} stays within its section's bottom edge`).toBeLessThanOrEqual(section!.rect.y + section!.rect.height + 1);
        expect(intersectsByMoreThanOnePixel(card.rect, section!.heading), `${card.href} overlaps its category heading`).toBe(false);
    }
}

async function expectToolCardsKeyboardReachable(
    page: import("@playwright/test").Page,
    registeredTools: RegisteredToolLink[],
    populatedCategories: string[],
): Promise<void> {
    const links = page.locator('main a.catalog-card[href^="/tool/"]');
    const expectedHrefs = orderedToolsByCategory(registeredTools, populatedCategories).map(tool => tool.href);
    await links.first().focus();
    for (let index = 0; index < expectedHrefs.length; index += 1) {
        if (index > 0) await page.keyboard.press("Tab");
        await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute("href")))
            .toBe(expectedHrefs[index]);
    }
}

async function expectLayoutAcrossAppearanceSelections(
    page: import("@playwright/test").Page,
    registeredTools: RegisteredToolLink[],
    populatedCategories: string[],
): Promise<void> {
    await page.getByRole("button", { name: "Themes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Appearance settings" });
    const paletteGroup = dialog.getByRole("group", { name: "Palette", exact: true });
    const palettes = paletteGroup.getByRole("radio");
    await expect(palettes).toHaveCount(7);

    const oneDark = dialog.getByRole("radio", { name: "One Dark", exact: true });
    for (const palette of await palettes.all()) {
        if (await palette.getAttribute("value") === "onedark") continue;
        await palette.check();
        for (const mode of ["Light", "Dark", "System"]) {
            await dialog.getByRole("radio", { name: mode, exact: true }).check();
            if (mode === "System") {
                for (const scheme of ["light", "dark"] as const) {
                    await page.emulateMedia({ colorScheme: scheme });
                    await expectHomeLayout(page, registeredTools, populatedCategories);
                }
            } else {
                await expectHomeLayout(page, registeredTools, populatedCategories);
            }
        }
    }
    await oneDark.check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "onedark");
    await expectHomeLayout(page, registeredTools, populatedCategories);
}

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    test(`homepage category geometry is exhaustive at ${viewport.name}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/discover");
        const registeredTools = await page.getByRole("main").locator('a[href^="/tool/"]').evaluateAll(links =>
            links.map(link => ({ href: (link as HTMLAnchorElement).getAttribute("href") ?? "", category: link.getAttribute("data-category") ?? "" })),
        );
        expect(registeredTools.length).toBeGreaterThan(0);
        expect(new Set(registeredTools.map(tool => tool.href)).size).toBe(registeredTools.length);
        const populatedCategories = tool_category_definition_list
            .map(category => category.id)
            .filter(category => registeredTools.some(tool => tool.category === category));
        await page.goto("/");
        await expectHomeLayout(page, registeredTools, populatedCategories);
        await expectToolCardsKeyboardReachable(page, registeredTools, populatedCategories);
        await expectLayoutAcrossAppearanceSelections(page, registeredTools, populatedCategories);
    });
}
