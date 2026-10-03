export type ThemeId = "system" | "light" | "dark" | "onedark";

interface ThemeEntry {
    id: ThemeId;
    label: string;
    description?: string;
}

const theme_definition_list: ThemeEntry[] = [
    { id: "system", label: "System", description: "Follow light or dark system preference" },
    { id: "light", label: "Light", description: "Clean colorful light" },
    { id: "dark", label: "Dark", description: "Restrained slate dark" },
    { id: "onedark", label: "One Dark", description: "Purple developer dark" },
];

export function listThemes(): ThemeEntry[] {
    return theme_definition_list;
}

export function isThemeId(x: unknown): x is ThemeId {
    return theme_definition_list.some((theme) => theme.id === x);
}
