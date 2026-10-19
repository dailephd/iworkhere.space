/** @vitest-environment jsdom */
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportCoordinator } from "./SupportCoordinator";
import type { SupportContextSource } from "./context";
import type { TurnstileChallengeProps, TurnstileHandle } from "./TurnstileChallenge";

const { pathname, challenge } = vi.hoisted(() => ({ pathname: { value: "/" }, challenge: { issue: (() => {}) as (token: string | null) => void } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
// The challenge is replaced by an in-memory stub that issues a token on mount and after each reset.
vi.mock("./TurnstileChallenge", () => ({
    TurnstileChallenge: forwardRef<TurnstileHandle, TurnstileChallengeProps>(function Stub({ onToken }, ref) {
        useEffect(() => { challenge.issue = onToken; onToken("stub-token"); }, [onToken]);
        useImperativeHandle(ref, () => ({ reset() { onToken(null); } }), [onToken]);
        return <div data-testid="support-challenge" />;
    }),
}));

const source: SupportContextSource = {
    tool: [{ id: "merge-pdf", slug: "merge-pdf", name: "Merge PDF" }, { id: "calculator", slug: "calculator", name: "Calculator" }],
    category: ["document"],
};
const SENTINEL = "SENTINEL private narrative";
let host: HTMLDivElement;
let root: Root;
let fetcher: ReturnType<typeof vi.fn>;

function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status }); }
const created = () => json(201, { schemaVersion: 1, reportId: "SR-0123456789ABCDEF", receivedAt: "2026-10-19T12:00:00.000Z" });
async function mount(siteKey: string | null = "site-key") {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<SupportCoordinator source={source} siteKey={siteKey ?? undefined} />));
}
const dialog = () => document.querySelector<HTMLDialogElement>('[data-testid="support-dialog"]');
const trigger = () => [...document.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === "Report a problem or suggestion")!;
const field = (label: RegExp) => [...document.querySelectorAll<HTMLElement>("select, textarea, input")].find(element => label.test(document.querySelector(`label[for="${element.id}"]`)?.textContent ?? element.closest("label")?.textContent ?? ""))!;
async function open() { await act(async () => trigger().click()); }
async function type(element: HTMLElement, value: string) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
        element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
}
async function check(element: HTMLElement) { await act(async () => element.click()); }
const submitButton = () => [...document.querySelectorAll<HTMLButtonElement>('button[type="submit"]')][0];
async function submit() { await act(async () => submitButton().click()); }
async function refreshToken(token = "stub-token-2") { await act(async () => challenge.issue(token)); }
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
async function fillValid() {
    await type(field(/What kind of report/), "tool_failure");
    await type(field(/Describe what happened/), SENTINEL);
    await flush();
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    pathname.value = "/tool/merge-pdf";
    fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("11111111-1111-4111-8111-111111111111").mockReturnValueOnce("22222222-2222-4222-8222-222222222222").mockReturnValue("33333333-3333-4333-8333-333333333333") });
    localStorage.clear(); sessionStorage.clear();
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("entry and defaults", () => {
    it("offers exactly one site-wide entry that opens a labelled modal dialog", async () => {
        await mount();
        expect(document.querySelectorAll("button")).toHaveLength(1);
        expect(dialog()).toBeNull();
        await open();
        expect(dialog()!.getAttribute("aria-labelledby")).toBeTruthy();
        expect(document.getElementById(dialog()!.getAttribute("aria-labelledby")!)!.textContent).toBe("Report a problem or suggestion");
        expect(dialog()!.hasAttribute("open")).toBe(true);
    });
    it("keeps the full accessible name while offering a compact visible label, and still owns the one dialog", async () => {
        await mount();
        const button = trigger();
        expect(button.getAttribute("aria-label")).toBe("Report a problem or suggestion");
        expect(button.querySelector('[data-support-label="full"]')!.textContent).toBe("Report a problem or suggestion");
        const compact = button.querySelector('[data-support-label="compact"]')!;
        expect(compact.textContent).toBe("Report");
        expect(compact.getAttribute("aria-hidden")).toBe("true");
        await act(async () => compact.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        expect(document.querySelectorAll("dialog")).toHaveLength(1);
        expect(document.querySelectorAll("button[aria-haspopup='dialog']")).toHaveLength(1);
    });

    it("defaults to the registered tool of a tool route and Site-wide elsewhere", async () => {
        await mount();
        await open();
        expect((field(/Where did it happen/) as HTMLSelectElement).value).toBe("tool:merge-pdf");
        await check([...document.querySelectorAll("button")].find(button => button.textContent === "Cancel")!);
        pathname.value = "/";
        await act(async () => root.render(<SupportCoordinator source={source} siteKey="site-key" />));
        await open();
        expect((field(/Where did it happen/) as HTMLSelectElement).value).toBe("site-wide");
    });
    it("never invents a tool for unknown routes", async () => {
        pathname.value = "/tool/not-a-tool";
        await mount();
        await open();
        expect((field(/Where did it happen/) as HTMLSelectElement).value).toBe("site-wide");
    });
    it("lets the user correct the affected tool and lists only registered tools", async () => {
        await mount();
        await open();
        const options = [...(field(/Where did it happen/) as HTMLSelectElement).options].map(option => option.value);
        expect(options).toEqual(["site-wide", "tool:merge-pdf", "tool:calculator", "other"]);
        await type(field(/Where did it happen/), "tool:calculator");
        await fillValid();
        fetcher.mockResolvedValue(created());
        await submit();
        const body = JSON.parse(fetcher.mock.calls[0][1].body);
        expect(body).toMatchObject({ area: "tool", toolId: "calculator", pathname: "/tool/merge-pdf" });
    });
});

describe("form content", () => {
    it("presents category-specific fields and conditional requirements", async () => {
        await mount();
        await open();
        await type(field(/What kind of report/), "incorrect_result");
        expect(document.body.textContent).toContain("Expected result (required)");
        expect((field(/Expected result/) as HTMLTextAreaElement).required).toBe(true);
        await type(field(/What kind of report/), "suggestion");
        expect(document.body.textContent).toContain("What improvement would help?");
        expect(document.body.textContent).toContain("Suggested use case (optional)");
        expect(document.body.textContent).not.toContain("Expected result");
        await type(field(/What kind of report/), "tool_failure");
        expect(document.body.textContent).toContain("Expected behavior (optional)");
    });
    it("keeps contact consent off by default, never asks for files and shows privacy guidance", async () => {
        await mount();
        await open();
        expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
        expect(document.querySelector('input[type="file"]')).toBeNull();
        expect(document.body.textContent).toMatch(/Do not include passwords, secret tokens, private documents/);
        expect(document.body.textContent).toMatch(/only use your address if you check the box/);
    });
    it("offers every report category", async () => {
        await mount();
        await open();
        const values = [...(field(/What kind of report/) as HTMLSelectElement).options].map(option => option.value).filter(Boolean);
        expect(values).toEqual(["incorrect_result", "tool_failure", "invalid_output", "interface_accessibility", "performance_compatibility", "content_link", "privacy_security", "suggestion", "other"]);
    });
});

describe("validation", () => {
    it("shows visible errors tied to their fields and sends nothing", async () => {
        await mount();
        await open();
        await flush();
        await submit();
        expect(fetcher).not.toHaveBeenCalled();
        const category = field(/What kind of report/);
        expect(category.getAttribute("aria-invalid")).toBe("true");
        const message = document.getElementById(category.getAttribute("aria-describedby")!.split(" ").find(id => id.endsWith("-error"))!)!;
        expect(message.textContent).toBe("This field is required.");
        expect(field(/Describe what happened/).getAttribute("aria-invalid")).toBe("true");
    });
    it("requires expected behavior for an incorrect result and an address for consent", async () => {
        await mount();
        await open();
        await type(field(/What kind of report/), "incorrect_result");
        await type(field(/Describe what happened/), "wrong");
        await check(document.querySelector('input[type="checkbox"]')!);
        await flush();
        await submit();
        expect(fetcher).not.toHaveBeenCalled();
        expect(document.body.textContent).toMatch(/This field is required\./);
        expect(field(/Expected result/).getAttribute("aria-invalid")).toBe("true");
        expect(field(/Email for a receipt/).getAttribute("aria-invalid")).toBe("true");
    });
    it("disables submission when no challenge key is configured and says so", async () => {
        await mount(null);
        await open();
        expect(submitButton().disabled).toBe(true);
        expect(document.body.textContent).toContain("Reporting is not available right now.");
    });
});

describe("submission", () => {
    it("posts the exact contract, then shows an accessible receipt with the reference", async () => {
        fetcher.mockResolvedValue(created());
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(fetcher).toHaveBeenCalledTimes(1);
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("/api/support/report");
        expect(init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer" });
        expect(JSON.parse(init.body)).toEqual({
            schemaVersion: 1, category: "tool_failure", area: "tool", toolId: "merge-pdf", pathname: "/tool/merge-pdf", description: SENTINEL,
            contactConsent: false, idempotencyKey: "11111111-1111-4111-8111-111111111111", turnstileToken: "stub-token",
        });
        const status = document.querySelector('[role="status"]')!;
        expect(status.textContent).toContain("Your report was received.");
        expect(document.querySelector('[data-testid="support-reference"]')!.textContent).toBe("SR-0123456789ABCDEF");
        expect(localStorage.length + sessionStorage.length).toBe(0);
    });
    it("sends the address only with consent", async () => {
        fetcher.mockResolvedValue(created());
        await mount();
        await open();
        await fillValid();
        await type(field(/Email for a receipt/), "Reader@Example.com");
        await check(document.querySelector('input[type="checkbox"]')!);
        await submit();
        expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ email: "Reader@Example.com", contactConsent: true });
    });
    it("prevents duplicate activation: one request while in flight and a disabled form", async () => {
        let release: (response: Response) => void = () => {};
        fetcher.mockReturnValue(new Promise<Response>(resolve => { release = resolve; }));
        await mount();
        await open();
        await fillValid();
        await submit();
        await submit();
        await act(async () => { submitButton().form!.requestSubmit(); });
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(submitButton().disabled).toBe(true);
        expect(submitButton().textContent).toBe("Sending…");
        expect(document.querySelector("fieldset")!.disabled).toBe(true);
        expect(document.querySelector("form")!.getAttribute("aria-busy")).toBe("true");
        await act(async () => release(created()));
        expect(document.querySelector('[data-testid="support-reference"]')).not.toBeNull();
    });
    it("keeps the draft after a server failure and retries with the same idempotency key", async () => {
        fetcher.mockResolvedValueOnce(json(503, { error: "unavailable" })).mockResolvedValueOnce(created());
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(document.querySelector('[role="alert"]')!.textContent).toMatch(/has not been saved/);
        expect(document.querySelector('[data-testid="support-reference"]')).toBeNull();
        expect((field(/Describe what happened/) as HTMLTextAreaElement).value).toBe(SENTINEL);
        expect(submitButton().textContent).toBe("Try again");
        await refreshToken();
        await submit();
        const keys = fetcher.mock.calls.map(call => JSON.parse(call[1].body).idempotencyKey);
        expect(keys[0]).toBe(keys[1]);
        expect(keys[0]).toBe("11111111-1111-4111-8111-111111111111");
        expect(document.querySelector('[data-testid="support-reference"]')).not.toBeNull();
    });
    it("uses a new idempotency key when the draft changed after a failure", async () => {
        fetcher.mockResolvedValueOnce(json(503, { error: "unavailable" })).mockResolvedValueOnce(created());
        await mount();
        await open();
        await fillValid();
        await submit();
        await type(field(/Describe what happened/), `${SENTINEL} edited`);
        await refreshToken();
        await submit();
        const keys = fetcher.mock.calls.map(call => JSON.parse(call[1].body).idempotencyKey);
        expect(keys[0]).not.toBe(keys[1]);
    });
    it("requests a fresh challenge token for every attempt", async () => {
        fetcher.mockResolvedValueOnce(json(503, { error: "unavailable" })).mockResolvedValueOnce(created());
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(submitButton().disabled).toBe(true);
        await refreshToken();
        expect(submitButton().disabled).toBe(false);
        await submit();
        expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body).turnstileToken)).toEqual(["stub-token", "stub-token-2"]);
    });
    it.each([
        ["a network failure", () => Promise.reject(new TypeError("Failed to fetch")), /could not reach the server\. Your report has not been sent/],
        ["a rate limit", () => Promise.resolve(json(429, { error: "rate_limited" })), /Too many reports/],
        ["a failed challenge", () => Promise.resolve(json(429, { error: "challenge_failed" })), /verification check failed/],
        ["an oversize rejection", () => Promise.resolve(json(413, { error: "payload_too_large" })), /too large/],
        ["a malformed receipt", () => Promise.resolve(json(201, { reportId: "bad" })), /may not have been saved/],
        ["an unexpected status", () => Promise.resolve(json(500, {})), /may not have been saved/],
    ])("reports %s truthfully without a receipt", async (_label, response, message) => {
        fetcher.mockImplementation(response);
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(document.querySelector('[role="alert"]')!.textContent).toMatch(message);
        expect(document.querySelector('[data-testid="support-reference"]')).toBeNull();
        expect((field(/Describe what happened/) as HTMLTextAreaElement).value).toBe(SENTINEL);
    });
    it("says offline when the browser is offline", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        fetcher.mockRejectedValue(new TypeError("Failed to fetch"));
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(document.querySelector('[role="alert"]')!.textContent).toMatch(/offline\. Your report has not been sent/);
        expect(document.querySelector('[data-testid="support-reference"]')).toBeNull();
    });
    it("maps server field errors onto the form and keeps the draft", async () => {
        fetcher.mockResolvedValue(json(400, { error: "invalid_request", fieldError: { description: "too_long" } }));
        await mount();
        await open();
        await fillValid();
        await submit();
        expect(document.body.textContent).toContain("This is too long.");
        expect(field(/Describe what happened/).getAttribute("aria-invalid")).toBe("true");
    });
    it("never persists the narrative or address in browser storage or cookies", async () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        fetcher.mockResolvedValue(created());
        await mount();
        await open();
        await fillValid();
        await type(field(/Email for a receipt/), "reader@example.com");
        await submit();
        expect(setItem).not.toHaveBeenCalled();
        expect(document.cookie).toBe("");
        expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(SENTINEL);
    });
});

describe("closing and focus", () => {
    it("closes on Escape (native cancel) and returns focus to the originating trigger", async () => {
        await mount();
        trigger().focus();
        await open();
        await act(async () => { dialog()!.dispatchEvent(new Event("cancel", { cancelable: true })); });
        expect(dialog()).toBeNull();
        expect(document.activeElement).toBe(trigger());
    });
    it("ignores Escape while a submission is in flight", async () => {
        fetcher.mockReturnValue(new Promise(() => {}));
        await mount();
        await open();
        await fillValid();
        await submit();
        await act(async () => { dialog()!.dispatchEvent(new Event("cancel", { cancelable: true })); });
        expect(dialog()).not.toBeNull();
    });
    it("keeps an unsent draft when the dialog is closed and reopened, and clears it after success", async () => {
        fetcher.mockResolvedValue(created());
        await mount();
        await open();
        await fillValid();
        await check([...document.querySelectorAll("button")].find(button => button.textContent === "Cancel")!);
        expect(dialog()).toBeNull();
        await open();
        expect((field(/Describe what happened/) as HTMLTextAreaElement).value).toBe(SENTINEL);
        await submit();
        await check([...document.querySelectorAll("button")].find(button => button.textContent === "Close")!);
        expect(document.activeElement).toBe(trigger());
        await open();
        expect((field(/Describe what happened/) as HTMLTextAreaElement).value).toBe("");
        expect((field(/What kind of report/) as HTMLSelectElement).value).toBe("");
    });
    it("renders the dialog outside the footer so the contentinfo landmark keeps one purpose", async () => {
        await mount();
        await open();
        expect(host.contains(dialog())).toBe(false);
        expect(dialog()!.parentElement).toBe(document.body);
    });
});
