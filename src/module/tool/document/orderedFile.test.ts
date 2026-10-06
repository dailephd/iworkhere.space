import { expect, it } from "vitest";
import { addOrderedFile, moveOrderedFile, removeOrderedFile, type OrderedFileItem } from "./orderedFile";
it("keeps deterministic pure local file order and stable identities", () => {
    const item: OrderedFileItem<{ pages: number }>[] = ["a", "b", "c"].map(id => ({ id, file: new File(["local"], "local.pdf"), metadata: { pages: 1 } }));
    expect(addOrderedFile(item.slice(0, 1), [item[0], item[1], { ...item[2], id: "" }])).toEqual(item.slice(0, 2));
    expect(removeOrderedFile(item, "b").map(value => value.id)).toEqual(["a", "c"]);
    expect(moveOrderedFile(item, "b", "up").map(value => value.id)).toEqual(["b", "a", "c"]);
    expect(moveOrderedFile(item, "b", "down").map(value => value.id)).toEqual(["a", "c", "b"]);
    for (const [id, direction] of [["a", "up"], ["c", "down"], ["missing", "up"]] as const) expect(moveOrderedFile(item, id, direction)).toEqual(item);
    expect(item.map(value => value.id)).toEqual(["a", "b", "c"]);
});
