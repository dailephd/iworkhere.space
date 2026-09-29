const BLOCK_TAG = new Set([
    "div", "p", "section", "article", "header", "footer", "main", "nav",
    "aside", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr",
    "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote", "hr",
]);

const SKIP_TAG = new Set(["script", "style"]);

/**
 * Extracts visible text from an HTML string, preserving structural line breaks.
 *
 * Uses DOMParser (browser-only). Must be called in a client context.
 */
export function extractHtmlText(html: string): string {
    if (!html.trim()) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const chunks: string[] = [];
    traverse(doc.body, chunks);

    let result = chunks.join("");

    // Trim trailing spaces on each line
    result = result
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .join("\n");

    // Collapse 3+ consecutive newlines to 2
    result = result.replace(/\n{3,}/g, "\n\n");

    // Trim leading/trailing whitespace
    result = result.trim();

    return result;
}

function traverse(node: Node, chunks: string[]): void {
    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = (child.textContent ?? "").replace(/[\t ]+/g, " ");
            if (text) {
                chunks.push(text);
            }
            continue;
        }

        if (child.nodeType !== Node.ELEMENT_NODE) continue;

        const el = child as Element;
        const tag = el.tagName.toLowerCase();

        if (SKIP_TAG.has(tag)) continue;

        if (tag === "br") {
            chunks.push("\n");
            continue;
        }

        traverse(el, chunks);

        if (BLOCK_TAG.has(tag)) {
            chunks.push("\n");
        }
    }
}
