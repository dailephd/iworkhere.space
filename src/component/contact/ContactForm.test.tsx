/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "./ContactForm";

let host: HTMLDivElement;
let root: Root;
let fetcher: ReturnType<typeof vi.fn>;

const SENTINEL = "SENTINEL private narrative that must stay in the field";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    localStorage.clear();
});

async function mount() {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<ContactForm />));
}

const form = () => host.querySelector<HTMLFormElement>("form")!;
const control = (label: RegExp) => [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].find(element => label.test(host.querySelector(`label[for="${element.id}"]`)?.textContent ?? ""))!;
const email = () => control(/Your email/) as HTMLInputElement;
const title = () => control(/^Title/) as HTMLInputElement;
const message = () => control(/^Message/) as HTMLTextAreaElement;
const honeypot = () => control(/Company website/) as HTMLInputElement;
const button = (name: string) => [...host.querySelectorAll("button")].find(element => element.textContent === name)!;
const status = () => host.querySelector('[role="status"]')!;
const alertRegion = () => host.querySelector('[role="alert"]')!;

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
async function fill(overrides: Partial<Record<"email" | "title" | "message", string>> = {}) {
    await type(email(), overrides.email ?? "visitor@example.com");
    await type(title(), overrides.title ?? "A question");
    await type(message(), overrides.message ?? SENTINEL);
}
async function submit() {
    await act(async () => button("Submit").click());
}
const posted = () => JSON.parse(fetcher.mock.calls[0][1].body as string) as Record<string, string>;

describe("structure and accessibility", () => {
    it("renders three labelled required fields, a hidden honeypot and the two actions", async () => {
        await mount();
        expect(form().getAttribute("aria-label")).toBe("Contact form");
        expect(email().type).toBe("email");
        expect(email().autocomplete).toBe("email");
        for (const field of [email(), title(), message()]) expect(field.required).toBe(true);
        expect(title().maxLength).toBe(200);
        expect(message().maxLength).toBe(10000);
        expect(button("Submit").getAttribute("type")).toBe("submit");
        expect(button("Clear message").getAttribute("type")).toBe("button");
        expect(host.querySelectorAll("input[type=file]")).toHaveLength(0);
    });

    it("keeps the honeypot out of view, out of the tab order and away from assistive technology", async () => {
        await mount();
        const trap = honeypot();
        expect(trap.tabIndex).toBe(-1);
        expect(trap.autocomplete).toBe("off");
        const wrapper = trap.parentElement!;
        expect(wrapper.hidden).toBe(true);
        expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    });

    it("keeps persistent status and alert live regions mounted", async () => {
        await mount();
        expect(status().getAttribute("aria-live")).toBe("polite");
        expect(alertRegion()).not.toBeNull();
        expect(status().textContent).toBe("");
        expect(alertRegion().textContent).toBe("");
    });

    it("cannot leak visitor text into a URL: no field has a name and the fallback method is POST", async () => {
        await mount();
        expect(form().method).toBe("post");
        expect(form().getAttribute("action")).toBe("/api/contact");
        for (const field of host.querySelectorAll("input, textarea")) expect(field.hasAttribute("name")).toBe(false);
    });
});

describe("validation", () => {
    it("rejects an empty submit with field messages, keeps focus handling and sends nothing", async () => {
        await mount();
        await submit();
        expect(fetcher).not.toHaveBeenCalled();
        expect(alertRegion().textContent).toContain("Some details need attention");
        expect(host.textContent).toContain("Enter your email address.");
        expect(host.textContent).toContain("Enter a title.");
        expect(host.textContent).toContain("Enter a message.");
        expect(email().getAttribute("aria-invalid")).toBe("true");
        expect(document.activeElement).toBe(email());
    });

    it("links each message to its field and clears the message after a valid retry", async () => {
        await mount();
        await submit();
        const described = email().getAttribute("aria-describedby")!;
        expect(document.getElementById(described)!.textContent).toBe("Enter your email address.");
        await fill();
        await submit();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(email().getAttribute("aria-invalid")).toBeNull();
    });

    it("validates the email format, trimming first", async () => {
        await mount();
        await fill({ email: "not-an-email" });
        await submit();
        expect(fetcher).not.toHaveBeenCalled();
        expect(host.textContent).toContain("Enter a valid email address.");
        expect(email().value).toBe("not-an-email");
        await type(email(), "  visitor@example.com  ");
        await submit();
        expect(posted().senderEmail).toBe("visitor@example.com");
    });

    it("requires a message of at least 10 characters and keeps what was typed", async () => {
        await mount();
        await fill({ message: "too short" });
        await submit();
        expect(fetcher).not.toHaveBeenCalled();
        expect(host.textContent).toContain("Write at least 10 characters.");
        expect(message().value).toBe("too short");
        expect(document.activeElement).toBe(message());
    });

    it("treats a whitespace-only title as missing", async () => {
        await mount();
        await fill({ title: "     " });
        await submit();
        expect(host.textContent).toContain("Enter a title.");
        expect(fetcher).not.toHaveBeenCalled();
    });
});

describe("submission", () => {
    it("posts JSON to /api/contact with the trimmed fields and the honeypot field", async () => {
        await mount();
        await fill({ title: "  A question  " });
        await submit();
        expect(fetcher).toHaveBeenCalledTimes(1);
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("/api/contact");
        expect(init.method).toBe("POST");
        expect(init.headers).toEqual({ "Content-Type": "application/json" });
        expect(posted()).toEqual({ senderEmail: "visitor@example.com", title: "A question", message: SENTINEL, companyWebsite: "" });
    });

    it("posts a filled honeypot so the server can detect it", async () => {
        await mount();
        await fill();
        await type(honeypot(), "http://spam.example");
        await submit();
        expect(posted().companyWebsite).toBe("http://spam.example");
    });

    it("shows a pending state, blocks duplicate submits and disables the actions while sending", async () => {
        let finish!: (response: Response) => void;
        fetcher.mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
        await mount();
        await fill();
        await submit();
        expect(status().textContent).toContain("Sending your message");
        expect(form().getAttribute("aria-busy")).toBe("true");
        expect(button("Sending…").hasAttribute("disabled")).toBe(true);
        expect(button("Clear message").hasAttribute("disabled")).toBe(true);
        for (const field of [email(), title(), message()]) expect(field.readOnly).toBe(true);
        await act(async () => { form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
        await act(async () => { form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
        expect(fetcher).toHaveBeenCalledTimes(1);
        await act(async () => finish(json(200, { ok: true })));
        expect(form().getAttribute("aria-busy")).toBe("false");
        expect(button("Submit").hasAttribute("disabled")).toBe(false);
    });

    it("clears the form and announces a modest success without promising delivery or a reply time", async () => {
        await mount();
        await fill();
        await submit();
        expect(email().value).toBe("");
        expect(title().value).toBe("");
        expect(message().value).toBe("");
        const text = status().textContent!;
        expect(text).toContain("submitted for delivery");
        expect(text).toContain("do not promise a reply");
        expect(text).not.toMatch(/delivered to your|inbox placement|within \d|will reply|received your/i);
        expect(alertRegion().textContent).toBe("");
    });

    it("does not treat an OK status without { ok: true } as success", async () => {
        fetcher.mockResolvedValue(new Response("<html>proxy page</html>", { status: 200 }));
        await mount();
        await fill();
        await submit();
        expect(status().textContent).toBe("");
        expect(alertRegion().textContent).toContain("may not have been sent");
        expect(message().value).toBe(SENTINEL);
    });

    it.each([
        [503, { ok: false, error: "unavailable" }, "temporarily unavailable"],
        [502, { ok: false, error: "delivery_failed" }, "may not have been sent"],
        [403, { ok: false, error: "forbidden" }, "Reload the page"],
        [413, { ok: false, error: "too_large" }, "too large"],
        [500, "garbage", "may not have been sent"],
    ])("keeps the draft and offers a retry after a %i response", async (statusCode, body, expected) => {
        fetcher.mockResolvedValueOnce(typeof body === "string" ? new Response(body, { status: statusCode }) : json(statusCode, body));
        await mount();
        await fill();
        await submit();
        expect(alertRegion().textContent).toContain(expected);
        expect(alertRegion().textContent).toContain("text has been kept");
        expect(status().textContent).toBe("");
        expect(email().value).toBe("visitor@example.com");
        expect(title().value).toBe("A question");
        expect(message().value).toBe(SENTINEL);
        expect(button("Submit").hasAttribute("disabled")).toBe(false);
        // Retry succeeds with the preserved text.
        await submit();
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetcher.mock.calls[1][1].body).message).toBe(SENTINEL);
        expect(status().textContent).toContain("submitted for delivery");
        expect(alertRegion().textContent).toBe("");
    });

    it("keeps the draft and says so when the network fails", async () => {
        fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await mount();
        await fill();
        await submit();
        expect(alertRegion().textContent).toContain("could not reach the server");
        expect(alertRegion().textContent).not.toContain("Failed to fetch");
        expect(message().value).toBe(SENTINEL);
    });

    it("marks the field the server rejected and moves focus to it", async () => {
        fetcher.mockResolvedValueOnce(json(400, { ok: false, error: "invalid_field", field: "title" }));
        await mount();
        await fill();
        await submit();
        expect(title().getAttribute("aria-invalid")).toBe("true");
        expect(document.activeElement).toBe(title());
        expect(message().value).toBe(SENTINEL);
    });

    it("never displays provider internals, secrets or environment names from an error body", async () => {
        fetcher.mockResolvedValueOnce(json(502, { ok: false, error: "delivery_failed", detail: "RESEND_API_KEY re_live_secret domain not verified", message: "provider said no" }));
        await mount();
        await fill();
        await submit();
        for (const text of ["RESEND_API_KEY", "re_live_secret", "not verified", "provider said no"]) expect(host.textContent).not.toContain(text);
    });
});

describe("clearing and privacy", () => {
    it("clears every field, the status and the errors", async () => {
        await mount();
        await submit();
        await fill();
        await act(async () => button("Clear message").click());
        expect(email().value).toBe("");
        expect(title().value).toBe("");
        expect(message().value).toBe("");
        expect(alertRegion().textContent).toBe("");
        expect(status().textContent).toBe("");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("never stores the draft or calls any endpoint other than /api/contact", async () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        await mount();
        await fill();
        await submit();
        expect(setItem).not.toHaveBeenCalled();
        expect(document.cookie).toBe("");
        expect(fetcher.mock.calls.map(call => call[0])).toEqual(["/api/contact"]);
    });

    it("renders no report button, dialog or support controls", async () => {
        await mount();
        expect(host.querySelectorAll("dialog")).toHaveLength(0);
        expect(host.querySelector("[aria-haspopup]")).toBeNull();
        expect(host.textContent).not.toMatch(/Report Issues|problem or suggestion/);
    });
});
