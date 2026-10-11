import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import reference from "../../../test/fixtures/palette-reference.json";
import { listPalettes } from "./themeRegistry";

interface TokenBlock { selector: string; tokens: Record<string, string>; }
const css = readFileSync("src/style/theme.css", "utf8");
const blocks: TokenBlock[] = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(match => ({
    selector: match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\r/g, ""),
    tokens: Object.fromEntries([...match[2].matchAll(/(--palette-[\w-]+)\s*:\s*([^;]+);/g)].map(pair => [pair[1], pair[2].trim().replace(/\s+/g, " ")])),
})).filter(block => Object.keys(block.tokens).length > 0);
function resolved(palette: string, mode: string) {
    const values: Record<string, string> = {};
    for (const block of blocks) {
        const belongs = !block.selector.includes("data-palette") || block.selector.includes(`data-palette='${palette}'`);
        const dark = block.selector.includes("data-theme='dark'") || block.selector.includes(":root.dark");
        if (belongs && (!dark || mode === "dark")) Object.assign(values, block.tokens);
    }
    const resolve = (key: string): string => values[key].replace(/var\((--[\w-]+)\)/g, (_, target) => resolve(target));
    return (name: string) => resolve(`--palette-${name}`);
}
function selectionGround(selection: string, ground: string): string {
    const channel = selection.match(/\d+(?:\.\d+)?/g)!.map(Number);
    const alpha = channel[3] / 100;
    return "#" + [1, 3, 5].map((offset, i) => Math.round(channel[i] * alpha + parseInt(ground.slice(offset, offset + 2), 16) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}
function ratio(a: string, b: string) {
    const lum = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + .05) / (lo + .05);
}
describe("documented palette tokens", () => {
    test("retains every reference token and alias without changing brand colors", () => {
        expect(blocks).toEqual(reference.blocks);
        expect(blocks).toHaveLength(12);
    });
    for (const palette of listPalettes().filter(p => p.id !== "onedark")) {
        for (const mode of ["light", "dark"]) {
            test(`${palette.label} ${mode}: readable text, functional accents and focus`, () => {
                const token = resolved(palette.id, mode);
                for (const surface of ["background", "surface", "card", "elevated"]) {
                    for (const text of ["text-primary", "text-secondary", "text-muted", "accent-primary-text", "accent-secondary-text"]) {
                        expect(ratio(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
                    }
                    expect(ratio(token("text-primary"), selectionGround(token("selection"), token(surface))), `selection on ${surface}`).toBeGreaterThanOrEqual(4.5);
                    expect(ratio(token("focus-ring"), token(surface))).toBeGreaterThanOrEqual(3);
                    expect(ratio(token("border-strong"), token(surface))).toBeGreaterThanOrEqual(3);
                }
                expect(ratio(token("on-accent"), token("accent-primary-text"))).toBeGreaterThanOrEqual(4.5);
                expect(ratio(token("on-accent"), token("action-hover"))).toBeGreaterThanOrEqual(4.5);
            });
        }
    }
});
