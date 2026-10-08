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
