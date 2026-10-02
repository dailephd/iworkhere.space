import { describe, test, expect } from "vitest";
import { listThemes, isThemeId } from "./themeRegistry";

const ids = ["system", "light", "dark", "onedark"];
const retired = ["vscode-modern", "dracula", "amethyst-haze", "mercury-fog", "civic-light", "spectrum"];
describe("theme registry", () => {
    test("has exactly the four canonical choices in order", () => {
        expect(listThemes()).toHaveLength(4);
        expect(listThemes().map(theme => theme.id)).toEqual(ids);
        expect(listThemes().map(theme => theme.label)).toEqual(["System", "Light", "Dark", "One Dark"]);
        expect(listThemes().map(theme => theme.description)).toEqual([
            "Follow light or dark system preference", "Clean colorful light", "Restrained slate dark",
            "Purple developer dark",
        ]);
    });
    test.each(ids)("accepts %s", id => expect(isThemeId(id)).toBe(true));
    test.each([...retired, "unknown", "", null, undefined, 42])("rejects %s", id => expect(isThemeId(id)).toBe(false));
});
