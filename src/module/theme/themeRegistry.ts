export type ThemeId =
    | "system"
    | "light"
    | "dark"
    | "onedark"
    | "vscode-modern"
    | "dracula"
    | "amethyst-haze"
    | "mercury-fog";

interface ThemeEntry {
    id: ThemeId;
    label: string;
    description?: string;
}

const theme_definition_list: ThemeEntry[] = [
    { id: "system", label: "System", description: "Follow system preference" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "onedark", label: "One Dark" },
    { id: "vscode-modern", label: "VS Code Modern" },
    { id: "dracula", label: "Dracula" },
    { id: "amethyst-haze", label: "Amethyst Haze" },
    { id: "mercury-fog", label: "Mercury Fog" },
];

export function listThemes(): ThemeEntry[] {
    return theme_definition_list;
}

export function isThemeId(x: unknown): x is ThemeId {
    return theme_definition_list.some((t) => t.id === x);
}
