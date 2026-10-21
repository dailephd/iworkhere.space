import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { ProviderState } from "./support/providerDouble";

/**
 * Production-equivalent reporting journey: the built application (public flag on) calls the real
 * /api/support endpoints, which persist into a disposable PostgreSQL through least-privilege roles.
 * Provider calls go to isolated substitutes. Run through `npm run test:support-e2e`.
 */
const container = process.env.SUPPORT_E2E_CONTAINER ?? "";
const providerOrigin = process.env.SUPPORT_E2E_PROVIDER_ORIGIN ?? "";
const cronSecret = process.env.SUPPORT_E2E_CRON_SECRET ?? "";
const outputPath = process.env.SUPPORT_E2E_OUTPUT ?? "";
const VALID_TOKEN = "e2e-valid-token";
const created: string[] = [];
const sentinels: string[] = [];

const test = base.extend({
    page: async ({ page, context }, providePage) => {
        const failures: string[] = [];
        page.on("pageerror", error => failures.push(`pageerror: ${error.message}`));
        page.on("console", message => {
            if (/hydrat|did not match|server rendered html/i.test(message.text())) failures.push(`hydration diagnostic: ${message.text()}`);
        });
        // Only the browser-side widget script is substituted; the server still verifies against the verifier double.
        await context.route("https://challenges.cloudflare.com/**", route => route.fulfill({ contentType: "application/javascript", body: `
            let callback = null;
            const issue = () => setTimeout(() => callback && callback("${VALID_TOKEN}"), 30);
            window.turnstile = {
                render(element, options) { callback = options.callback; issue(); return "widget-1"; },
                reset() { issue(); },
                remove() { callback = null; },
            };` }));
        await providePage(page);
        expect(failures, "No page errors or hydration diagnostics").toEqual([]);
    },
});

function db(statement: string): string {
    const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement], { encoding: "utf8", windowsHide: true, shell: false });
    if (result.status !== 0) throw new Error(`database query failed: ${result.stderr}`);
    return result.stdout.trim();
}
async function providerState(request: APIRequestContext): Promise<ProviderState> {
    return (await request.get(`${providerOrigin}/__state`)).json();
}
async function control(request: APIRequestContext, body: Record<string, unknown>) {
    expect((await request.post(`${providerOrigin}/__control`, { data: body })).ok()).toBe(true);
}
async function runWorker(request: APIRequestContext) {
    const response = await request.get("/api/support/deliver", { headers: { authorization: `Bearer ${cronSecret}` } });
    expect(response.status()).toBe(200);
    return response.json() as Promise<{ claimed: number; delivered: number; retried: number; dead: number; purged: boolean }>;
}
async function drainQueue(request: APIRequestContext) {
    for (let round = 0; round < 12; round++) if ((await runWorker(request)).claimed === 0) return;
    throw new Error("Queue did not drain");
}
function unique(label: string): string {
    const text = `E2E-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sentinels.push(text);
    return text;
}
const entry = (page: Page) => page.getByRole("contentinfo").getByRole("button", { name: "Report Issues — report a problem or suggestion", exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Report a problem or suggestion" });
const send = (page: Page) => dialog(page).getByRole("button", { name: /^(Send report|Try again)$/ });
async function open(page: Page, route: string) {
    await page.goto(route);
    await expect(entry(page)).toHaveCount(1);
    await entry(page).click();
    await expect(dialog(page)).toBeVisible();
}
async function fill(page: Page, values: { category?: string; description: string; email?: string; consent?: boolean; expected?: string }) {
    const form = dialog(page);
    await form.getByLabel(/What kind of report/).selectOption(values.category ?? "tool_failure");
    await form.getByLabel(/Describe what happened/).fill(values.description);
    if (values.expected !== undefined) await form.getByLabel(/Expected/).fill(values.expected);
    if (values.email) await form.getByLabel(/Email for a receipt/).fill(values.email);
    if (values.consent) await form.getByRole("checkbox").check();
    await expect(send(page)).toBeEnabled();
}
async function reference(page: Page): Promise<string> {
    const id = (await page.getByTestId("support-reference").textContent()) ?? "";
    expect(id).toMatch(/^SR-[0-9A-HJKMNP-TV-Z]{16}$/);
    created.push(id);
    return id;
}
function body(overrides: Record<string, unknown> = {}) {
    return { schemaVersion: 1, category: "other", area: "site-wide", pathname: "/", description: "API contract check", contactConsent: false, idempotencyKey: crypto.randomUUID(), turnstileToken: VALID_TOKEN, ...overrides };
}

test.afterAll(() => { if (outputPath) writeFileSync(outputPath, JSON.stringify({ created, sentinels }, null, 2)); });

test("the entry is reachable from the home page and a tool page and opens an accessible modal dialog", async ({ page }) => {
    for (const [route, area] of [["/", "Site-wide"], ["/tool/merge-pdf", "Merge PDF"]] as const) {
        await open(page, route);
        await expect(dialog(page).getByRole("heading", { level: 2, name: "Report a problem or suggestion" })).toBeVisible();
        await expect(dialog(page).getByLabel(/Where did it happen/)).toHaveValue(area === "Site-wide" ? "site-wide" : "tool:merge-pdf");
        await expect(dialog(page).getByRole("checkbox")).not.toBeChecked();
        await expect(dialog(page).locator('input[type="file"]')).toHaveCount(0);
        await expect(dialog(page)).toContainText("Do not include passwords, secret tokens");
        expect(await page.evaluate(() => document.querySelector("dialog")!.contains(document.activeElement))).toBe(true);
        // Focus stays contained: no Tab press can reach the inert page behind the modal.
        for (let press = 0; press < 24; press++) {
            await page.keyboard.press("Tab");
            expect(await page.evaluate(() => { const active = document.activeElement; return !active || active === document.body || document.querySelector("dialog")!.contains(active); }), `Tab ${press}`).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(dialog(page)).toBeHidden();
        await expect(entry(page)).toBeFocused();
    }
});

test("a visitor can correct the affected tool and sees category-specific fields", async ({ page }) => {
    await open(page, "/tool/merge-pdf");
    const form = dialog(page);
    await form.getByLabel(/Where did it happen/).selectOption("tool:calculator");
    await expect(form.getByLabel(/Where did it happen/)).toHaveValue("tool:calculator");
    await form.getByLabel(/What kind of report/).selectOption("incorrect_result");
    await expect(form.getByLabel("Expected result (required)")).toBeVisible();
    await form.getByLabel(/What kind of report/).selectOption("suggestion");
    await expect(form.getByLabel(/What improvement would help/)).toBeVisible();
    await expect(form.getByLabel("Suggested use case (optional)")).toBeVisible();
});

test("a tool-page report is durable, receipted and leaks nothing to telemetry or storage", async ({ page, context }) => {
    const narrative = unique("tool");
    const telemetry: string[] = [];
    const reportRequests: string[] = [];
    page.on("request", request => {
        const path = new URL(request.url()).pathname;
        if (/^\/api\/(metric|log)$/.test(path)) telemetry.push(request.postData() ?? "");
        if (path === "/api/support/report") reportRequests.push(request.postData() ?? "");
    });
    await open(page, "/tool/merge-pdf");
    await fill(page, { description: narrative });
    await send(page).click();
    await expect(dialog(page)).toContainText("Your report was received.");
    const id = await reference(page);
    expect(reportRequests).toHaveLength(1);
    expect(db(`SELECT category || '|' || area || '|' || tool_id || '|' || pathname || '|' || description || '|' || (contact_email IS NULL) FROM support.report WHERE id = '${id}'`)).toBe(`tool_failure|tool|merge-pdf|/tool/merge-pdf|${narrative}|true`);
    expect(db(`SELECT string_agg(kind || ':' || status, ',' ORDER BY kind) FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("github_issue:pending,operator_email:pending");
    expect(telemetry.join("\n")).not.toContain(narrative);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(narrative);
    expect(await page.evaluate(async () => { const names = await caches.keys(); const urls: string[] = []; for (const name of names) for (const request of await (await caches.open(name)).keys()) urls.push(request.url); return urls.filter(url => url.includes("/api/support")); })).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(entry(page)).toBeFocused();
});

test("a general-page report with consent queues a receipt job and stores the address", async ({ page }) => {
    const narrative = unique("general");
    await open(page, "/");
    await fill(page, { category: "interface_accessibility", description: narrative, email: "Reader@Example.com", consent: true });
    await send(page).click();
    await expect(dialog(page)).toContainText("Your report was received.");
    const id = await reference(page);
    expect(db(`SELECT area || '|' || pathname || '|' || contact_email || '|' || contact_consent FROM support.report WHERE id = '${id}'`)).toBe("site-wide|/|reader@example.com|true");
    expect(db(`SELECT string_agg(kind, ',' ORDER BY kind) FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("contact_receipt,github_issue,operator_email");
});

test("an email entered without consent is discarded", async ({ page }) => {
    const narrative = unique("no-consent");
    await open(page, "/");
    await fill(page, { description: narrative, email: "ignored@example.com" });
    await send(page).click();
    await expect(dialog(page)).toContainText("Your report was received.");
    const id = await reference(page);
    expect(db(`SELECT (contact_email IS NULL) || '|' || contact_consent FROM support.report WHERE id = '${id}'`)).toBe("true|false");
    expect(db(`SELECT count(*) FROM support.outbox_job WHERE report_id = '${id}' AND kind = 'contact_receipt'`)).toBe("0");
});

test("duplicate activation sends one request and stores one report", async ({ page }) => {
    const narrative = unique("double");
    let requests = 0;
    await page.route("**/api/support/report", async route => { requests += 1; await new Promise(resolve => setTimeout(resolve, 400)); await route.continue(); });
    await open(page, "/");
    await fill(page, { description: narrative });
    await send(page).dblclick();
    await expect(dialog(page)).toContainText("Your report was received.");
    await reference(page);
    expect(requests).toBe(1);
    expect(db(`SELECT count(*) FROM support.report WHERE description = '${narrative}'`)).toBe("1");
});

test("a failed submission keeps the draft and a retry stores exactly one report", async ({ page }) => {
    const narrative = unique("retry");
    let attempts = 0;
    await page.route("**/api/support/report", async route => {
        attempts += 1;
        if (attempts === 1) return route.abort("failed");
        if (attempts === 2) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
        return route.continue();
    });
    await open(page, "/");
    await fill(page, { description: narrative, email: "retry@example.com", consent: true });
    await send(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText("Your report has not been sent");
    await expect(page.getByTestId("support-reference")).toHaveCount(0);
    await expect(dialog(page).getByLabel(/Describe what happened/)).toHaveValue(narrative);
    await expect(send(page)).toBeEnabled();
    await send(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText("has not been saved");
    await expect(dialog(page).getByLabel(/Describe what happened/)).toHaveValue(narrative);
    await expect(send(page)).toBeEnabled();
    await send(page).click();
    await expect(dialog(page)).toContainText("Your report was received.");
    await reference(page);
    expect(attempts).toBe(3);
    expect(db(`SELECT count(*) FROM support.report WHERE description = '${narrative}'`)).toBe("1");
});

test("an offline browser never reports success", async ({ page, context }) => {
    const narrative = unique("offline");
    await open(page, "/");
    await fill(page, { description: narrative });
    await context.setOffline(true);
    await send(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText("offline");
    await expect(page.getByTestId("support-reference")).toHaveCount(0);
    await context.setOffline(false);
    expect(db(`SELECT count(*) FROM support.report WHERE description = '${narrative}'`)).toBe("0");
});

test("the HTTP contract enforces validation, size, origin, challenge and idempotency against the real database", async ({ request }) => {
    const before = Number(db("SELECT count(*) FROM support.report"));
    expect((await request.post("/api/support/report", { data: body({ category: "nope" }) })).status()).toBe(400);
    expect((await request.post("/api/support/report", { data: body({ filename: "private.pdf" }) })).status()).toBe(400);
    expect((await request.post("/api/support/report", { data: body({ area: "tool", toolId: "not-a-tool" }) })).status()).toBe(400);
    expect((await request.post("/api/support/report", { data: body({ pathname: "/tool/merge-pdf?secret=1" }) })).status()).toBe(400);
    const oversize = await request.post("/api/support/report", { data: body({ description: "x".repeat(20_000) }) });
    expect(oversize.status()).toBe(413);
    expect((await request.post("/api/support/report", { data: body(), headers: { origin: "https://evil.example" } })).status()).toBe(403);
    const rejected = await request.post("/api/support/report", { data: body({ turnstileToken: "e2e-bad-token" }) });
    expect(rejected.status()).toBe(429);
    expect(await rejected.json()).toEqual({ error: "challenge_failed" });
    expect(Number(db("SELECT count(*) FROM support.report"))).toBe(before);
    const key = crypto.randomUUID();
    const first = await request.post("/api/support/report", { data: body({ idempotencyKey: key, description: unique("idempotent") }) });
    expect(first.status()).toBe(201);
    const receipt = await first.json();
    created.push(receipt.reportId);
    const replay = await request.post("/api/support/report", { data: body({ idempotencyKey: key, description: sentinels.at(-1) }) });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).reportId).toBe(receipt.reportId);
    expect((await request.post("/api/support/report", { data: body({ idempotencyKey: key, description: "a different report" }) })).status()).toBe(409);
    expect(db(`SELECT count(*) FROM support.report WHERE idempotency_key = '${key}'`)).toBe("1");
    expect(db(`SELECT count(*) FROM support.outbox_job WHERE report_id = '${receipt.reportId}'`)).toBe("2");
});

test("the delivery worker rejects unauthorized calls and delivers private, narrative-free notifications", async ({ request }) => {
    await drainQueue(request);
    const narrative = unique("worker");
    const response = await request.post("/api/support/report", { data: body({ category: "privacy_security", area: "tool", toolId: "calculator", pathname: "/tool/calculator", description: narrative, email: "worker@example.com", contactConsent: true }) });
    expect(response.status()).toBe(201);
    const id = (await response.json()).reportId as string;
    created.push(id);
    expect((await request.get("/api/support/deliver")).status()).toBe(401);
    expect((await request.get("/api/support/deliver", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    expect(db(`SELECT string_agg(status, ',') FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("pending,pending,pending");
    await drainQueue(request);
    expect(db(`SELECT string_agg(status || ':' || attempt_count, ',' ORDER BY kind) FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("delivered:1,delivered:1,delivered:1");
    expect(db(`SELECT tracker_issue_url IS NOT NULL FROM support.report WHERE id = '${id}'`)).toBe("t");
    const state = await providerState(request);
    const issue = state.issues.find(item => item.body.includes(`support-report:${id}`))!;
    expect(issue.title).toBe(`[Support] ${id} privacy_security`);
    expect(issue.body).toContain("Triage: https://dashboard.e2e.test/support/" + id);
    expect(state.issues.filter(item => item.body.includes(`support-report:${id}`))).toHaveLength(1);
    const everything = JSON.stringify(state);
    for (const text of sentinels) expect(everything, text).not.toContain(text);
    const operator = state.emails.find(email => email.to.includes("ops@e2e.test") && email.text.includes(id))!;
    expect(operator.text).not.toContain("worker@example.com");
    expect(operator.idempotencyKey).toMatch(/^support-[0-9a-f-]{36}$/);
    const receipt = state.emails.find(email => email.to.includes("worker@example.com") && email.text.includes(id))!;
    expect(receipt.text).toContain(id);
    expect(receipt.text).not.toMatch(/privacy_security|calculator/);
    expect(db(`SELECT last_correspondence_at IS NOT NULL FROM support.report WHERE id = '${id}'`)).toBe("t");
});

test("a provider timeout and an email outage recover without a duplicate issue or lost report", async ({ request }) => {
    await drainQueue(request);
    await control(request, { githubCreateMode: "timeout-after-create", resendFailures: 1 });
    const narrative = unique("recover");
    const response = await request.post("/api/support/report", { data: body({ description: narrative }) });
    expect(response.status()).toBe(201);
    const id = (await response.json()).reportId as string;
    created.push(id);
    const first = await runWorker(request);
    expect(first.claimed).toBe(2);
    expect(db(`SELECT string_agg(kind || ':' || status || ':' || coalesce(failure_code, '-'), ',' ORDER BY kind) FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("github_issue:pending:network,operator_email:pending:http_5xx");
    expect((await providerState(request)).issues.filter(item => item.body.includes(`support-report:${id}`))).toHaveLength(1);
    expect(db(`SELECT count(*) FROM support.report WHERE id = '${id}'`)).toBe("1");
    db(`UPDATE support.outbox_job SET next_attempt_at = now() WHERE report_id = '${id}'`);
    await runWorker(request);
    expect(db(`SELECT string_agg(kind || ':' || status || ':' || attempt_count, ',' ORDER BY kind) FROM support.outbox_job WHERE report_id = '${id}'`)).toBe("github_issue:delivered:2,operator_email:delivered:2");
    const state = await providerState(request);
    expect(state.issues.filter(item => item.body.includes(`support-report:${id}`))).toHaveLength(1);
    expect(db(`SELECT tracker_issue_number > 0 FROM support.report WHERE id = '${id}'`)).toBe("t");
    await control(request, { githubCreateMode: "ok", resendFailures: 0 });
});

test("the dialog fits the viewport without horizontal overflow and keeps every control reachable", async ({ page }) => {
    await open(page, "/");
    const box = await dialog(page).boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await send(page).scrollIntoViewIfNeeded();
    await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeVisible();
});
