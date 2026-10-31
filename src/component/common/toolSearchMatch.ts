/**
 * Pure, deterministic tool search over display-ready items.
 * Only real fields of each item are indexed; there is no synonym table, fuzzy matching or second tool list.
 */

export interface ToolSearchMatchItem {
    slug: string
    name: string
    description: string
    category: string
    categoryLabel: string
    tag?: readonly string[]
}

/** The only lexical normalizations applied to both the query and the indexed fields. */
const lexicalForm: Readonly<Record<string, string>> = {
    images: "image",
    photos: "photo",
    files: "file",
    pages: "page",
    tools: "tool",
    pdfs: "pdf",
    resizer: "resize",
    resizing: "resize",
    resized: "resize",
    converter: "convert",
    converting: "convert",
    converted: "convert",
    compressor: "compress",
    compressing: "compress",
    compressed: "compress",
    merger: "merge",
    merging: "merge",
    merged: "merge",
    splitter: "split",
    splitting: "split",
    formatter: "format",
    formatting: "format",
    formatted: "format",
    counter: "count",
    counting: "count",
    counted: "count",
}

const fillerToken: ReadonlySet<string> = new Set([
    "a", "an", "the", "to", "for", "with", "my", "and", "of", "in", "on", "please", "how", "do", "i", "want", "need", "tool",
])

const nameWeight = 4
const slugWeight = 4
const tagWeight = 3
const descriptionWeight = 2
const categoryWeight = 1
const phraseBonus = 10

function tokenize(text: string): string[] {
    return text
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .split(" ")
        .filter((token) => token.length > 0)
        .map((token) => lexicalForm[token] ?? token)
}

function queryToken(query: string): string[] {
    const all = tokenize(query)
    const meaningful = all.filter((token) => !fillerToken.has(token))
    return meaningful.length > 0 ? meaningful : all
}

function bestWeight(token: string, fieldSet: ReadonlyArray<{ weight: number; tokenSet: ReadonlySet<string> }>): number {
    let best = 0
    for (const field of fieldSet) {
        if (field.weight > best && field.tokenSet.has(token)) best = field.weight
    }
    return best
}

function scoreItem(item: ToolSearchMatchItem, token: readonly string[], phrase: string): number {
    const nameToken = tokenize(item.name)
    const slugToken = tokenize(item.slug)
    const fieldSet = [
        { weight: nameWeight, tokenSet: new Set(nameToken) },
        { weight: slugWeight, tokenSet: new Set(slugToken) },
        { weight: tagWeight, tokenSet: new Set((item.tag ?? []).flatMap((one) => tokenize(one))) },
        { weight: descriptionWeight, tokenSet: new Set(tokenize(item.description)) },
        { weight: categoryWeight, tokenSet: new Set([...tokenize(item.categoryLabel), ...tokenize(item.category)]) },
    ]

    let score = 0
    for (const one of token) {
        const weight = bestWeight(one, fieldSet)
        if (weight === 0) return 0
        score += weight
    }
    if (phrase.length > 0 && (nameToken.join(" ").includes(phrase) || slugToken.join(" ").includes(phrase))) score += phraseBonus
    return score
}

/**
 * Returns the items matching every meaningful query token, best first, registry order on ties.
 * An empty query returns the items in their given order. The input array is never mutated.
 */
export function searchToolItem<T extends ToolSearchMatchItem>(items: readonly T[], query: string, selectedTag?: string | null): T[] {
    const tagged = selectedTag ? items.filter((one) => one.tag?.includes(selectedTag)) : [...items]
    const token = queryToken(query)
    if (token.length === 0) return tagged

    const phrase = tokenize(query).join(" ")
    const scored: Array<{ one: T; score: number; order: number }> = []
    tagged.forEach((one, order) => {
        const score = scoreItem(one, token, phrase)
        if (score > 0) scored.push({ one, score, order })
    })
    scored.sort((left, right) => right.score - left.score || left.order - right.order)
    return scored.map((entry) => entry.one)
}
