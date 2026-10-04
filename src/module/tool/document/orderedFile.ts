export interface OrderedFileItem<Metadata> { id: string; file: File; metadata: Metadata }

export function addOrderedFile<Metadata>(item: readonly OrderedFileItem<Metadata>[], addition: readonly OrderedFileItem<Metadata>[]): OrderedFileItem<Metadata>[] {
    const id = new Set(item.map(value => value.id));
    const result = [...item];
    for (const value of addition) {
        if (!value.id || id.has(value.id)) continue;
        id.add(value.id); result.push(value);
    }
    return result;
}
export function removeOrderedFile<Metadata>(item: readonly OrderedFileItem<Metadata>[], id: string): OrderedFileItem<Metadata>[] {
    return item.filter(value => value.id !== id);
}
export function moveOrderedFile<Metadata>(item: readonly OrderedFileItem<Metadata>[], id: string, direction: "up" | "down"): OrderedFileItem<Metadata>[] {
    const result = [...item];
    const index = item.findIndex(value => value.id === id);
    const target = index + (direction === "up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= item.length) return result;
    [result[index], result[target]] = [result[target], result[index]];
    return result;
}
