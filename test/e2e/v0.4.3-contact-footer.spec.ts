import { test as base, expect, type Locator, type Page, type Request } from "@playwright/test";
import { getConsoleFailure } from "./support/browserDiagnostic";

// Same guarantees as ./support/fixture (no page errors, console errors, hydration diagnostics or advertising requests), with one
// allowance: Chromium logs a console error for every non-2xx response, so each deliberate failure response from /api/contact
// excuses exactly one such log line. Any other console error still fails the test.
const test = base.extend({
    page: async ({ page }, providePage) => {
        const failures: string[] = [];
        const advertisingRequests: string[] = [];
        let excusedResponses = 0;
        await page.context().route(/https?:\/\/([^/]*\.)?(googlesyndication\.com|doubleclick\.net|googleadservices\.com)\//, route => {
            advertisingRequests.push(new URL(route.request().url()).hostname);
            return route.abort();
        });
        page.on("response", response => {
            if (response.url().endsWith("/api/contact") && response.status() >= 400) excusedResponses += 1;
        });
        page.on("pageerror", error => failures.push(`pageerror: ${error.message}`));
        page.on("console", message => {
            const failure = getConsoleFailure({ type: message.type(), text: message.text() });
            if (!failure) return;
            if (/Failed to load resource: the server responded with a status of 4\d\d|5\d\d/.test(message.text()) && excusedResponses > 0) { excusedResponses -= 1; return; }
            failures.push(failure);
        });
        await providePage(page);
        expect(failures, "No page errors, console errors or hydration diagnostics").toEqual([]);
        expect(advertisingRequests, "Ads disabled: no live Google advertising requests").toEqual([]);
    },
});

// Same convention as the v0.4.2 specs: this flag marks a build with NEXT_PUBLIC_SUPPORT_ENABLED=true.
const supportEnabled = process.env.E2E_SUPPORT_RUN === "true";
const reportName = "Report Issues — report a problem or suggestion";
const SENTINEL = "SENTINEL private narrative that must stay in the field";

const footer = (page: Page) => page.getByRole("contentinfo");
const actions = (page: Page) => footer(page).locator("[data-footer-actions]");
const contactLink = (page: Page) => footer(page).getByRole("link", { name: "Contact Us", exact: true });
const privacyLink = (page: Page) => footer(page).getByRole("link", { name: "Privacy Policy", exact: true });
const reportButton = (page: Page) => footer(page).getByRole("button", { name: reportName, exact: true });

const form = (page: Page) => page.getByRole("form", { name: "Contact form" });
const emailField = (page: Page) => form(page).getByRole("textbox", { name: "Your email", exact: true });
const titleField = (page: Page) => form(page).getByRole("textbox", { name: "Title", exact: true });
const messageField = (page: Page) => form(page).getByRole("textbox", { name: "Message", exact: true });
const submitButton = (page: Page) => form(page).getByRole("button", { name: /^(Submit|Sending…)$/ });
const clearButton = (page: Page) => form(page).getByRole("button", { name: "Clear message", exact: true });
const formStatus = (page: Page) => form(page).getByRole("status");
const formAlert = (page: Page) => form(page).getByRole("alert");

async function fillForm(page: Page, overrides: Partial<{ email: string; title: string; message: string }> = {}) {
    await emailField(page).fill(overrides.email ?? "visitor@example.com");
    await titleField(page).fill(overrides.title ?? "A question");
    await messageField(page).fill(overrides.message ?? SENTINEL);
}

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const geometry = (locator: Locator) => locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
});

// The contact endpoint must never reach a real provider from a test. A configured process or a remote base URL is therefore not exercised.
const baseIsLocal = !process.env.E2E_BASE_URL || /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(process.env.E2E_BASE_URL);
const providerConfigured = Boolean(process.env.RESEND_API_KEY || process.env.CONTACT_TO_EMAIL || process.env.CONTACT_FROM_EMAIL);
const realServerSafe = baseIsLocal && !providerConfigured;

// --- About and Contact pages -------------------------------------------------------------------

test("About renders the publisher information, links and metadata with no advertising", async ({ page, request }) => {
    const response = await request.get("/about");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(/adsbygoogle|Advertisement/);
    await page.goto("/about");
    await expect(page).toHaveTitle("iworkhere");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About iworkhere.space");
    await expect(page.getByRole("main")).toContainText("dailephd LLC");
    await expect(page.getByRole("main").getByRole("link", { name: "contact us", exact: true })).toHaveAttribute("href", "/contact");
    await expect(page.getByRole("main").getByRole("link", { name: "Privacy Policy", exact: true })).toHaveAttribute("href", "/privacy");
    await expect(page.getByRole("main").getByRole("link", { name: "All tools", exact: true })).toHaveAttribute("href", "/discover");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(["Tools designed for everyday work", "Working in your browser", "About the publisher"]);
    await expect(page.getByRole("main")).not.toContainText(/Release history|v0\.4\.2|Who publishes it/);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
});

test("About is reachable from the primary navigation by keyboard", async ({ page }) => {
    await page.goto("/");
    const about = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "About", exact: true });
    await expect(about).toHaveAttribute("href", "/about");
    await about.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About iworkhere.space");
    // The footer group does not gain an About row.
    await expect(actions(page).getByRole("link", { name: "About" })).toHaveCount(0);
});

test("Contact renders one H1, the form, metadata and a privacy path, and discloses no address", async ({ page, request }) => {
    const response = await request.get("/contact");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(/adsbygoogle|Advertisement|mailto:/);
    expect(html).not.toMatch(/RESEND_API_KEY|CONTACT_TO_EMAIL|CONTACT_FROM_EMAIL/);
    await page.goto("/contact");
    await expect(page).toHaveTitle("iworkhere");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://iworkhere.space/contact");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact Us");
    await expect(form(page)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(await noHorizontalOverflow(page)).toBe(true);
});

test("sitemap lists About and Contact exactly once and no API route", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(30);
    expect(xml.match(/<loc>https:\/\/iworkhere\.space\/about<\/loc>/g)).toHaveLength(1);
    expect(xml.match(/<loc>https:\/\/iworkhere\.space\/contact<\/loc>/g)).toHaveLength(1);
    expect(xml).not.toContain("/api/");
});

// --- Contact form behavior ---------------------------------------------------------------------

test("an empty or invalid submission shows accessible field errors, sends nothing and keeps focus on the first problem", async ({ page }) => {
    const posts: Request[] = [];
    page.on("request", request => { if (request.url().includes("/api/contact")) posts.push(request); });
    await page.goto("/contact");
    await submitButton(page).click();
    await expect(formAlert(page)).toContainText("Some details need attention");
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(emailField(page)).toBeFocused();
    await expect(form(page)).toContainText("Enter your email address.");
    await fillForm(page, { email: "not-an-email", message: "short" });
    await submitButton(page).click();
    await expect(form(page)).toContainText("Enter a valid email address.");
    await expect(emailField(page)).toBeFocused();
    await emailField(page).fill("visitor@example.com");
    await submitButton(page).click();
    await expect(form(page)).toContainText("Write at least 10 characters.");
    await expect(messageField(page)).toBeFocused();
    await expect(messageField(page)).toHaveValue("short");
    expect(posts).toHaveLength(0);
});

test("a failed submission keeps the draft and a retry succeeds, posting the honeypot field each time", async ({ page }) => {
    const bodies: Array<Record<string, unknown>> = [];
    let attempt = 0;
    await page.route("**/api/contact", async route => {
        bodies.push(route.request().postDataJSON());
        attempt += 1;
        if (attempt === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "unavailable" }) });
        else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/contact");
    await fillForm(page);
    await submitButton(page).click();
    await expect(formAlert(page)).toContainText("temporarily unavailable");
    await expect(formAlert(page)).toContainText("text has been kept");
    await expect(emailField(page)).toHaveValue("visitor@example.com");
    await expect(titleField(page)).toHaveValue("A question");
    await expect(messageField(page)).toHaveValue(SENTINEL);
    await expect(formStatus(page)).toHaveText("");
    await submitButton(page).click();
    await expect(formStatus(page)).toContainText("submitted for delivery");
    await expect(formStatus(page)).toContainText("do not promise a reply");
    await expect(formAlert(page)).toHaveText("");
    await expect(messageField(page)).toHaveValue("");
    await expect(emailField(page)).toHaveValue("");
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
        expect(Object.keys(body).sort()).toEqual(["companyWebsite", "message", "senderEmail", "title"]);
        expect(body).toMatchObject({ senderEmail: "visitor@example.com", title: "A question", message: SENTINEL, companyWebsite: "" });
    }
});

test("the form shows a pending state, disables its actions and ignores a second submit while sending", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let count = 0;
    await page.route("**/api/contact", async route => {
        count += 1;
        await gate;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/contact");
    await fillForm(page);
    await messageField(page).press("Tab");
    await expect(submitButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(formStatus(page)).toContainText("Sending your message");
    await expect(form(page)).toHaveAttribute("aria-busy", "true");
    await expect(submitButton(page)).toBeDisabled();
    await expect(clearButton(page)).toBeDisabled();
    await expect(messageField(page)).toHaveAttribute("readonly", "");
    await page.keyboard.press("Enter");
    release();
    await expect(formStatus(page)).toContainText("submitted for delivery");
    expect(count).toBe(1);
    await expect(submitButton(page)).toBeEnabled();
});

test("Clear message empties the form and its status without sending", async ({ page }) => {
    let posted = 0;
    await page.route("**/api/contact", route => { posted += 1; return route.abort(); });
    await page.goto("/contact");
    await submitButton(page).click();
    await expect(formAlert(page)).toContainText("Some details need attention");
    await fillForm(page);
    await clearButton(page).click();
    await expect(emailField(page)).toHaveValue("");
    await expect(titleField(page)).toHaveValue("");
    await expect(messageField(page)).toHaveValue("");
    await expect(formAlert(page)).toHaveText("");
    expect(posted).toBe(0);
});

test("the whole contact flow works with the keyboard alone", async ({ page }) => {
    await page.route("**/api/contact", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
    await page.goto("/contact");
    await emailField(page).focus();
    await page.keyboard.type("visitor@example.com");
    await page.keyboard.press("Tab");
    await expect(titleField(page)).toBeFocused();
    await page.keyboard.type("Keyboard only");
    await page.keyboard.press("Tab");
    await expect(messageField(page)).toBeFocused();
    await page.keyboard.type("Written without using a pointer.");
    await page.keyboard.press("Tab");
    await expect(submitButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(formStatus(page)).toContainText("submitted for delivery");
    // The honeypot is never a tab stop.
    await emailField(page).focus();
    for (let step = 0; step < 4; step += 1) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => document.activeElement?.closest("[hidden]") === null)).toBe(true);
    }
});

test("a filled honeypot is posted so the server can see it", async ({ page }) => {
    let body: Record<string, unknown> = {};
    await page.route("**/api/contact", route => { body = route.request().postDataJSON(); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); });
    await page.goto("/contact");
    await fillForm(page);
    await page.evaluate(() => {
        const trap = document.querySelector<HTMLInputElement>('[hidden] input[type="text"]')!;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(trap, "http://spam.example");
        trap.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await submitButton(page).click();
    await expect(formStatus(page)).toContainText("submitted for delivery");
    expect(body.companyWebsite).toBe("http://spam.example");
});

test("through the real server, an unconfigured provider fails closed, keeps the draft and exposes no internals", async ({ page }) => {
    test.skip(!realServerSafe, "Skipped so a test never sends through a configured provider or a remote deployment.");
    await page.goto("/contact");
    await fillForm(page);
    await submitButton(page).click();
    await expect(formAlert(page)).toContainText("temporarily unavailable");
    await expect(formStatus(page)).toHaveText("");
    await expect(messageField(page)).toHaveValue(SENTINEL);
    for (const text of ["RESEND", "CONTACT_", "Resend", "re_"]) await expect(formAlert(page)).not.toContainText(text);
});

test("the real endpoint enforces origin, content type, size, shape and honeypot rules without sending", async ({ request, baseURL }) => {
    test.skip(!realServerSafe, "Skipped so a test never sends through a configured provider or a remote deployment.");
    const origin = new URL(baseURL!).origin;
    const valid = { senderEmail: "visitor@example.com", title: "A question", message: "Hello, I have a question.", companyWebsite: "" };
    const post = (data: unknown, headers: Record<string, string> = {}) => request.post("/api/contact", {
        headers: { "Content-Type": "application/json", Origin: origin, ...headers },
        data: typeof data === "string" ? data : JSON.stringify(data),
    });

    const missingOrigin = await request.post("/api/contact", { headers: { "Content-Type": "application/json" }, data: JSON.stringify(valid) });
    expect(missingOrigin.status()).toBe(403);
    expect((await post(valid, { Origin: "https://evil.example" })).status()).toBe(403);
    expect((await post("{not json")).status()).toBe(400);
    expect((await post(valid, { "Content-Type": "text/plain" })).status()).toBe(400);
    expect((await post({ ...valid, extra: "x" })).status()).toBe(400);
    const invalid = await post({ ...valid, senderEmail: "nope" });
    expect(invalid.status()).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, error: "invalid_field", field: "senderEmail" });
    const oversize = await post({ ...valid, message: "m".repeat(70_000) });
    expect(oversize.status()).toBe(413);
    // The honeypot short-circuits before provider configuration is even consulted.
    const bot = await post({ ...valid, companyWebsite: "http://spam.example" });
    expect(bot.status()).toBe(200);
    expect(await bot.json()).toEqual({ ok: true });
    // A valid request reaches the unconfigured sender and fails closed with a generic answer.
    const unconfigured = await post(valid);
    expect(unconfigured.status()).toBe(503);
    expect(await unconfigured.json()).toEqual({ ok: false, error: "unavailable" });
    for (const response of [missingOrigin, unconfigured]) expect(response.headers()["cache-control"]).toBe("no-store");
});

test("contact never contacts a provider or any third party from the browser and ships no secrets", async ({ page }) => {
    const external: string[] = [];
    const scripts: string[] = [];
    page.on("request", request => {
        const url = new URL(request.url());
        if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname) && url.protocol.startsWith("http")) external.push(request.url());
    });
    page.on("response", async response => {
        if (response.request().resourceType() === "script") scripts.push(await response.text().catch(() => ""));
    });
    await page.route("**/api/contact", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
    await page.goto("/contact");
    await fillForm(page);
    await submitButton(page).click();
    await expect(formStatus(page)).toContainText("submitted for delivery");
    expect(external, "no third-party or provider request").toEqual([]);
    const bundle = scripts.join("\n");
    expect(bundle.length).toBeGreaterThan(1000);
    for (const secret of ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL", "api.resend.com", "re_live"]) expect(bundle, secret).not.toContain(secret);
});

test("contact works the same with reporting disabled or enabled and adds no second report control", async ({ page }) => {
    await page.route("**/api/contact", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
    await page.goto("/contact");
    await expect(form(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /Report/ })).toHaveCount(supportEnabled ? 1 : 0);
    await expect(page.getByRole("main").getByRole("button", { name: /Report/ })).toHaveCount(0);
    await expect(page.locator("dialog")).toHaveCount(0);
    await fillForm(page);
    await submitButton(page).click();
    await expect(formStatus(page)).toContainText("submitted for delivery");
    await expect(page.getByRole("button", { name: /Report/ })).toHaveCount(supportEnabled ? 1 : 0);
    await expect(page.locator("dialog")).toHaveCount(0);
});

// --- Footer ------------------------------------------------------------------------------------

test("the expanded footer lays out Contact Us, Report Issues (when enabled) and Privacy Policy in DOM and visual order on one row", async ({ page }) => {
    await page.goto("/contact");
    await expect(footer(page)).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(actions(page)).toHaveCount(1);
    const expected = supportEnabled ? ["Contact Us", "Report Issues", "Privacy Policy"] : ["Contact Us", "Privacy Policy"];

    // DOM order: the children of the one group, by their visible text.
    const domOrder = await actions(page).evaluate(group => [...group.children].map(child => (child as HTMLElement).innerText.trim()));
    expect(domOrder).toEqual(expected);

    // Visual order: strictly increasing lefts on one shared row (desktop); on narrow screens items may wrap but never reorder.
    const boxes = [await geometry(contactLink(page))];
    if (supportEnabled) boxes.push(await geometry(reportButton(page)));
    boxes.push(await geometry(privacyLink(page)));
    for (let index = 1; index < boxes.length; index += 1) {
        const previous = boxes[index - 1];
        const sameRow = Math.abs(boxes[index].top - previous.top) <= 2;
        const wrappedBelow = boxes[index].top >= previous.bottom - 1;
        expect(sameRow || wrappedBelow, `item ${index} follows item ${index - 1}`).toBe(true);
        if (sameRow) expect(boxes[index].left, `item ${index} is right of item ${index - 1}`).toBeGreaterThanOrEqual(previous.right - 1);
    }
    if (page.viewportSize()!.width >= 1024) {
        expect(Math.abs(boxes[boxes.length - 1].top - boxes[0].top), "desktop links share one row").toBeLessThanOrEqual(2);
    }
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(24);

    // One report trigger and no dialog, and the exact copyright line stays outside the group.
    await expect(page.getByRole("button", { name: /Report Issues/ })).toHaveCount(supportEnabled ? 1 : 0);
    await expect(page.locator("dialog")).toHaveCount(0);
    await expect(footer(page)).toContainText("© 2026 iworkhere.space created by dailephd LLC");
    await expect(actions(page)).not.toContainText("©");
    if (supportEnabled) {
        expect(await reportButton(page).innerText()).toBe("Report Issues");
        await expect(reportButton(page)).toHaveAttribute("aria-haspopup", "dialog");
    }
});

test("the group sits on the trailing side on desktop and stays inside the viewport on mobile", async ({ page }, testInfo) => {
    await page.goto("/contact");
    const group = await geometry(actions(page));
    const viewport = page.viewportSize()!;
    expect(group.left).toBeGreaterThanOrEqual(0);
    expect(group.right).toBeLessThanOrEqual(viewport.width);
    expect(await noHorizontalOverflow(page)).toBe(true);
    if (testInfo.project.name === "desktop-chromium") {
        const copyright = await geometry(footer(page).getByText("© 2026 iworkhere.space created by dailephd LLC"));
        expect(group.left, "actions trail the copyright on desktop").toBeGreaterThan(copyright.right);
    }
});

test("Contact Us and Privacy Policy are quiet links: no permanent underline, underline on hover, visible keyboard focus", async ({ page }, testInfo) => {
    await page.goto("/contact");
    for (const link of [contactLink(page), privacyLink(page)]) {
        const resting = await link.evaluate(element => getComputedStyle(element).textDecorationLine);
        expect(resting).toBe("none");
    }
    if (testInfo.project.name === "desktop-chromium") {
        await privacyLink(page).hover();
        expect(await privacyLink(page).evaluate(element => getComputedStyle(element).textDecorationLine)).toContain("underline");
        await page.mouse.move(0, 0);
    }
    // Keyboard focus, reached by tabbing from the page, shows a real outline.
    for (const target of ["/contact", "/privacy"]) {
        await page.locator("body").click({ position: { x: 1, y: 1 } });
        let reached = false;
        for (let step = 0; step < 90 && !reached; step += 1) {
            await page.keyboard.press("Tab");
            reached = await page.evaluate(path => document.activeElement?.getAttribute("href") === path && document.activeElement.closest("footer") !== null, target);
        }
        expect(reached, `Tab reaches the footer link ${target}`).toBe(true);
        const outline = await page.evaluate(() => {
            const style = getComputedStyle(document.activeElement!);
            return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), matches: document.activeElement!.matches(":focus-visible") };
        });
        expect(outline.matches).toBe(true);
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThanOrEqual(2);
    }
});

test("Contact Us and Privacy Policy navigate; the footer links work from a tool page", async ({ page }) => {
    await page.goto("/tool/json-formatter");
    await contactLink(page).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact Us");
    await privacyLink(page).click();
    await expect(page).toHaveURL(/\/privacy$/);
});

test("the footer links and copyright remain visible regardless of a saved collapsed preference", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("footer-preference", JSON.stringify("collapsed")));
    await page.goto("/contact");
    for (const route of ["/contact", "/about", "/privacy"]) {
        if (route !== "/contact") await page.goto(route);
        await expect(contactLink(page)).toBeVisible();
        await expect(privacyLink(page)).toBeVisible();
        await expect(footer(page).getByText("© 2026 iworkhere.space created by dailephd LLC")).toBeVisible();
        await expect(footer(page).getByRole("button", { name: /Hide footer|Show footer/ })).toHaveCount(0);
        await expect(page.locator("[data-footer-toggle], [data-footer-when]")).toHaveCount(0);
        await expect(reportButton(page)).toHaveCount(supportEnabled ? 1 : 0);
        if (supportEnabled) expect(await reportButton(page).innerText()).toBe("Report Issues");
    }
});

test("the footer stays compact, in ordinary flow and ends the document with no spacer", async ({ page }) => {
    await page.goto("/contact");
    const viewport = page.viewportSize()!;
    expect(await footer(page).evaluate(element => getComputedStyle(element).position)).toBe("static");
    await expect(page.locator("[data-footer-spacer]")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const measured = await geometry(footer(page));
    expect(measured.height, "the footer stays within a fifth of the viewport").toBeLessThanOrEqual(viewport.height * 0.2);
    expect(Math.abs(measured.bottom - viewport.height)).toBeLessThanOrEqual(1);
});

test("the last contact action and footer remain reachable at the document end", async ({ page }) => {
    await page.goto("/contact");
    await submitButton(page).scrollIntoViewIfNeeded();
    const above = await submitButton(page).evaluate(element => element.getBoundingClientRect().bottom <= document.querySelector("footer")!.getBoundingClientRect().top + 1);
    expect(above).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(footer(page)).toBeInViewport();
});
test("a focused contact field near the bottom is not hidden by the expanded footer", async ({ page }) => {
    await page.goto("/contact");
    await messageField(page).focus();
    await page.keyboard.press("Tab");
    await expect(submitButton(page)).toBeFocused();
    const hidden = await submitButton(page).evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > document.querySelector("footer")!.getBoundingClientRect().top + 1;
    });
    expect(hidden).toBe(false);
});

test("About, Contact and the footer coexist without a duplicate footer, report button or dialog on every new route", async ({ page }) => {
    for (const route of ["/about", "/contact", "/privacy"]) {
        await page.goto(route);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(page.getByRole("button", { name: /Report Issues/ })).toHaveCount(supportEnabled ? 1 : 0);
        await expect(page.locator("dialog")).toHaveCount(0);
        await expect(actions(page)).toHaveCount(1);
    }
});

test("reporting from Contact keeps the one existing dialog and does not touch the contact form", async ({ page }) => {
    test.skip(!supportEnabled, "The report trigger exists only in a support-enabled build.");
    await page.goto("/contact");
    await fillForm(page);
    await reportButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Report a problem or suggestion" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog")).toHaveCount(0);
    await expect(reportButton(page)).toBeFocused();
    await expect(messageField(page)).toHaveValue(SENTINEL);
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("Contact and the footer stay readable, the footer returns to normal flow and the links remain", async ({ page }) => {
        await page.goto("/contact");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact Us");
        await expect(page.getByRole("main")).toContainText("Sending a message requires JavaScript");
        expect(await page.locator("footer").evaluate(element => getComputedStyle(element).position)).toBe("static");
        await expect(contactLink(page)).toBeVisible();
        await expect(privacyLink(page)).toBeVisible();
        await expect(contactLink(page)).toHaveAttribute("href", "/contact");
        await expect(page.locator("[data-footer-toggle]")).toHaveCount(0);
        expect(await noHorizontalOverflow(page)).toBe(true);
    });

    test("About stays readable and links to Contact Us and the Privacy Policy", async ({ page }) => {
        await page.goto("/about");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("About iworkhere.space");
        await expect(page.getByRole("main").getByRole("link", { name: "Contact Us" })).toBeVisible();
        await expect(page.getByRole("main").getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    });

    test("submitting the form natively never puts visitor text in the URL", async ({ page }) => {
        await page.goto("/contact");
        await emailField(page).fill("visitor@example.com");
        await messageField(page).fill(SENTINEL);
        const [response] = await Promise.all([
            page.waitForResponse(candidate => candidate.url().endsWith("/api/contact")),
            submitButton(page).click(),
        ]);
        // The endpoint accepts only JSON, so the native form post is refused, and nothing was placed in any URL.
        expect([400, 403]).toContain(response.status());
        expect(page.url()).not.toContain("visitor");
        expect(page.url()).not.toContain("SENTINEL");
        expect(response.url()).not.toContain("visitor");
    });
});
