import { storage } from "@/lib/storage";

const STORAGE_KEY = "recent-tool";
const MAX_RECENT = 10;

export function getRecentTool(): string[] {
    const stored = storage.get<string[]>(STORAGE_KEY);
    if (!Array.isArray(stored)) return [];
    return stored;
}

export function recordRecentTool(slug: string): void {
    const current = getRecentTool();
    const filtered = current.filter((s) => s !== slug);
    const updated = [slug, ...filtered].slice(0, MAX_RECENT);
    storage.set(STORAGE_KEY, updated);
}

export function clearRecentTool(): void {
    storage.remove(STORAGE_KEY);
}
