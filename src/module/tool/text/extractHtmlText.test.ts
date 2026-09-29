// @vitest-environment jsdom

import { describe, test, expect } from "vitest";
import { extractHtmlText } from "./extractHtmlText";

describe("extractHtmlText", () => {
    test("extracts plain text from a simple paragraph", () => {
        expect(extractHtmlText("<p>Hello world</p>")).toBe("Hello world");
    });

    test("extracts text from nested elements", () => {
        const html = "<div><p>First</p><p>Second</p></div>";
        expect(extractHtmlText(html)).toBe("First\nSecond");
    });

    test("extracts text from deeply nested elements", () => {
        const html = "<div><section><article><p>Deep</p></article></section></div>";
        expect(extractHtmlText(html)).toBe("Deep");
    });

    test("skips script elements", () => {
        const html = '<p>Before</p><script>alert("xss")</script><p>After</p>';
        expect(extractHtmlText(html)).toBe("Before\nAfter");
    });

    test("skips style elements", () => {
        const html = "<p>Before</p><style>body { color: red; }</style><p>After</p>";
        expect(extractHtmlText(html)).toBe("Before\nAfter");
    });

    test("inserts line breaks for block-level elements", () => {
        const html = "<div>One</div><div>Two</div><div>Three</div>";
        expect(extractHtmlText(html)).toBe("One\nTwo\nThree");
    });

    test("inserts line break for br elements", () => {
        const html = "<p>Line one<br>Line two<br>Line three</p>";
        expect(extractHtmlText(html)).toBe("Line one\nLine two\nLine three");
    });

    test("handles h1-h6 as block elements", () => {
        const html = "<h1>Title</h1><h2>Subtitle</h2><p>Body</p>";
        expect(extractHtmlText(html)).toBe("Title\nSubtitle\nBody");
    });

    test("handles list elements", () => {
        const html = "<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>";
        expect(extractHtmlText(html)).toBe("Apple\nBanana\nCherry");
    });

    test("handles table elements", () => {
        const html = "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>";
        // tr and td are both block elements, so row boundaries produce a blank line
        expect(extractHtmlText(html)).toBe("A\nB\n\nC\nD");
    });

    test("collapses runs of spaces and tabs to a single space", () => {
        const html = "<p>Hello    world\t\ttab</p>";
        expect(extractHtmlText(html)).toBe("Hello world tab");
    });

    test("trims trailing spaces on each line", () => {
        const html = "<div>Hello   </div><div>World   </div>";
        const result = extractHtmlText(html);
        const lines = result.split("\n");
        for (const line of lines) {
            expect(line).toBe(line.replace(/\s+$/, ""));
        }
    });

    test("collapses 3+ consecutive newlines to at most 2", () => {
        const html = "<div>A</div><div></div><div></div><div></div><div>B</div>";
        const result = extractHtmlText(html);
        expect(result).not.toContain("\n\n\n");
    });

    test("returns empty string for empty input", () => {
        expect(extractHtmlText("")).toBe("");
    });

    test("returns empty string for whitespace-only input", () => {
        expect(extractHtmlText("   ")).toBe("");
    });

    test("resolves HTML entities", () => {
        const html = "<p>&amp; &lt; &gt; &quot;</p>";
        expect(extractHtmlText(html)).toBe('& < > "');
    });

    test("handles inline elements without adding line breaks", () => {
        const html = "<p>Hello <strong>bold</strong> and <em>italic</em> text</p>";
        expect(extractHtmlText(html)).toBe("Hello bold and italic text");
    });

    test("handles hr element", () => {
        const html = "<p>Above</p><hr><p>Below</p>";
        expect(extractHtmlText(html)).toBe("Above\n\nBelow");
    });

    test("handles blockquote element", () => {
        const html = "<blockquote>Quoted text</blockquote><p>Normal text</p>";
        expect(extractHtmlText(html)).toBe("Quoted text\nNormal text");
    });

    test("handles pre element", () => {
        const html = "<pre>Preformatted</pre><p>Normal</p>";
        expect(extractHtmlText(html)).toBe("Preformatted\nNormal");
    });

    test("handles mixed nested script and content", () => {
        const html = '<div>Visible<script>var x = 1;</script> text</div>';
        expect(extractHtmlText(html)).toBe("Visible text");
    });
});
