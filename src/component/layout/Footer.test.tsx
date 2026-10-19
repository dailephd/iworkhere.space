import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Footer } from "./Footer";

it("preserves copyright and exposes one keyboard-accessible privacy link", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain("© 2026 iworkhere.space created by dailephd LLC");
    expect(html.match(/href="\/privacy"/g)).toHaveLength(1);
    expect(html).toContain(">Privacy Policy</a>");
    expect(html).toContain("focus-visible:outline");
    expect(html).not.toContain("tabindex=\"-1\"");
});

it("renders an optional action beside the privacy link without owning its behavior", () => {
    const html = renderToStaticMarkup(<Footer action={<button type="button">Report a problem or suggestion</button>} />);
    expect(html.match(/Report a problem or suggestion/g)).toHaveLength(1);
    expect(html.match(/href="\/privacy"/g)).toHaveLength(1);
    expect(html.indexOf("Report a problem or suggestion")).toBeLessThan(html.indexOf("Privacy Policy"));
});

it("renders no action markup when none is supplied", () => {
    expect(renderToStaticMarkup(<Footer />)).not.toContain("<button");
});
