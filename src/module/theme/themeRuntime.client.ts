import type { ThemeId } from "./themeRegistry";

/**
 * Sets the active theme by writing (or removing) the data-theme attribute
 * on the root html element.
 *
 * "system" means no explicit choice — the CSS prefers-color-scheme rule applies.
 *
 * Must only be called in browser context (Client Components, effects, event handlers).
 */
export function setTheme(themeId: ThemeId): void {
    if (themeId === "system") {
        document.documentElement.removeAttribute("data-theme");
    } else {
        document.documentElement.setAttribute("data-theme", themeId);
    }
}

/**
 * Reads the current theme from the data-theme attribute on the root element.
 *
 * Returns "system" when no attribute is set.
 *
 * Must only be called in browser context.
 */
export function getThemeFromDom(): ThemeId {
    const value = document.documentElement.getAttribute("data-theme");
    if (value === "light") return "light";
    if (value === "dark") return "dark";
    if (value === "onedark") return "onedark";
    if (value === "vscode-modern") return "vscode-modern";
    if (value === "dracula") return "dracula";
    if (value === "amethyst-haze") return "amethyst-haze";
    if (value === "mercury-fog") return "mercury-fog";
    return "system";
}
