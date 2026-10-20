import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportDetailView, SupportListView } from "../component/SupportView";
import { ageLabel, ageMinutes, safeIssueUrl, type SupportDetailData, type SupportListData } from "./supportModel";

const now = new Date("2026-10-19T14:00:00.000Z");
const health = { undelivered_count: 3, retrying_count: 1, dead_count: 2, failing_count: 2, oldest_pending_at: "2026-10-19T12:30:00.000Z" };
const list: SupportListData = {
    report: [{ id: "SR-0123456789ABCDEF", category: "tool_failure", area: "tool", tool_id: "merge-pdf", pathname: "/tool/merge-pdf", received_at: "2026-10-19T12:00:00.000Z", dead_job_count: 1, undelivered_job_count: 2, has_tracker: true },
        { id: "SR-0123456789ABCDEG", category: "other", area: "site-wide", tool_id: null, pathname: "/", received_at: "2026-10-19T11:00:00.000Z", dead_job_count: 0, undelivered_job_count: 0, has_tracker: false }],
    hasNext: true, health,
};
const XSS = `<script>alert("xss")</script><img src=x onerror=alert(1)>`;
const detail = (override: Partial<SupportDetailData["report"]> = {}): SupportDetailData => ({
    report: { id: "SR-0123456789ABCDEF", category: "tool_failure", area: "tool", tool_id: "merge-pdf", pathname: "/tool/merge-pdf", received_at: "2026-10-19T12:00:00.000Z", description: XSS, expected: "Expected <b>bold</b>", observed: null, contact_email: "reader@example.com", contact_consent: true, tracker_issue_url: "https://github.com/owner/private-support/issues/7", narrative_purged_at: null, contact_purged_at: null, ...override },
    job: [{ kind: "github_issue", status: "delivered", attempt_count: 1, failure_code: null, next_attempt_at: "2026-10-19T12:00:00.000Z", delivered_at: "2026-10-19T12:01:00.000Z", updated_at: "2026-10-19T12:01:00.000Z" },
        { kind: "operator_email", status: "dead", attempt_count: 6, failure_code: "http_5xx", next_attempt_at: "2026-10-19T12:00:00.000Z", delivered_at: null, updated_at: "2026-10-19T13:00:00.000Z" },
        { kind: "contact_receipt", status: "pending", attempt_count: 2, failure_code: "timeout", next_attempt_at: "2026-10-19T14:10:00.000Z", delivered_at: null, updated_at: "2026-10-19T13:50:00.000Z" }],
});

describe("report list", () => {
    it("shows references, categories, areas, delivery state, health and pagination", () => {
        const html = renderToStaticMarkup(<SupportListView data={list} page={2} now={now} />);
        expect(html).toContain('href="/support/SR-0123456789ABCDEF"');
        expect(html).toContain("Tool: merge-pdf");
        expect(html).toContain("Site-wide");
        expect(html).toContain("1 dead-lettered");
        expect(html).toContain("Delivered");
        expect(html).toContain("issue linked");
        expect(html).toContain("Oldest pending age");
        expect(html).toContain("1 h 30 min");
        expect(html).toContain("Dead-lettered jobs need operator attention");
        expect(html).toContain('href="?page=1"');
        expect(html).toContain('href="?page=3"');
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain('aria-label="Reports table"');
    });
    it("renders an empty state without a table", () => {
        const html = renderToStaticMarkup(<SupportListView data={{ report: [], hasNext: false, health: { ...health, undelivered_count: 0, dead_count: 0, failing_count: 0, retrying_count: 0, oldest_pending_at: null } }} page={1} now={now} />);
        expect(html).toContain("No reports yet");
        expect(html).not.toContain("<table");
        expect(html).toContain("Nothing pending");
        expect(html).not.toContain("operator attention");
    });
    it("does not link anywhere but the report detail routes and the overview", () => {
        const html = renderToStaticMarkup(<SupportListView data={list} page={1} now={now} />);
        const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
        expect(hrefs.every(href => href === "/" || href.startsWith("/support") || href.startsWith("?page="))).toBe(true);
    });
});

describe("report detail", () => {
    it("renders untrusted narrative text escaped, never as markup", () => {
        const html = renderToStaticMarkup(<SupportDetailView data={detail()} now={now} />);
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("<b>bold</b>");
        expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
        expect(html).toContain("Expected &lt;b&gt;bold&lt;/b&gt;");
        expect(html).not.toContain("dangerouslySetInnerHTML");
    });
    it("shows contact details only with consent and the private issue link only for a GitHub issue URL", () => {
        const html = renderToStaticMarkup(<SupportDetailView data={detail()} now={now} />);
        expect(html).toContain("reader@example.com");
        expect(html).toContain('href="https://github.com/owner/private-support/issues/7" rel="noopener noreferrer"');
        const noConsent = renderToStaticMarkup(<SupportDetailView data={detail({ contact_consent: false, contact_email: null })} now={now} />);
        expect(noConsent).toContain("No consent to contact");
        expect(noConsent).not.toContain("reader@example.com");
        const hostile = renderToStaticMarkup(<SupportDetailView data={detail({ tracker_issue_url: "javascript:alert(1)" })} now={now} />);
        expect(hostile).not.toContain("javascript:");
        expect(hostile).toContain("Not created yet");
    });
    it("lists every delivery job with status, attempts, failure and retry visibility", () => {
        const html = renderToStaticMarkup(<SupportDetailView data={detail()} now={now} />);
        for (const text of ["github_issue", "operator_email", "contact_receipt", "dead", "http_5xx", "timeout", "2026-10-19T14:10:00.000Z", "2026-10-19T12:01:00.000Z"]) expect(html).toContain(text);
    });
    it("explains text removed by retention instead of showing blanks", () => {
        const html = renderToStaticMarkup(<SupportDetailView data={detail({ description: null, expected: null, observed: null, narrative_purged_at: "2027-04-17T00:00:00.000Z", contact_email: null, contact_purged_at: "2027-01-17T00:00:00.000Z" })} now={now} />);
        expect(html).toContain("Removed by retention at 2027-04-17T00:00:00.000Z");
        expect(html).toContain("Removed by retention at 2027-01-17T00:00:00.000Z");
    });
});

describe("model helpers", () => {
    it("computes ages and labels", () => {
        expect(ageMinutes(null, now)).toBeNull();
        expect(ageMinutes("garbage", now)).toBeNull();
        expect(ageMinutes("2026-10-19T14:30:00.000Z", now)).toBe(0);
        expect(ageMinutes("2026-10-19T12:30:00.000Z", now)).toBe(90);
        expect([ageLabel(null), ageLabel(5), ageLabel(90), ageLabel(60 * 49)]).toEqual(["Nothing pending", "5 min", "1 h 30 min", "2 d 1 h"]);
    });
    it("accepts only GitHub issue URLs", () => {
        expect(safeIssueUrl("https://github.com/o/r/issues/1")).toBe("https://github.com/o/r/issues/1");
        for (const bad of [null, "", "http://github.com/o/r/issues/1", "https://evil.example/o/r/issues/1", "https://github.com/o/r/pull/1", "javascript:alert(1)"]) expect(safeIssueUrl(bad)).toBeNull();
    });
});

describe("source boundaries", () => {
    function files(directory: string): string[] {
        return readdirSync(directory).flatMap(name => {
            const full = path.join(directory, name);
            return statSync(full).isDirectory() ? files(full) : [full];
        });
    }
    it("exposes no unauthenticated API route handlers", () => {
        const routes = files(path.resolve("src/app")).filter(file => /(^|[\\/])route\.(ts|tsx|js)$/.test(file));
        expect(routes).toEqual([]);
    });
    it("keeps support reads off the observability credential and observability reads off the support credential", () => {
        const read = (file: string) => readFileSync(path.resolve("src/lib", file), "utf8");
        expect(read("supportDatabase.server.ts")).toContain("SUPPORT_DASHBOARD_DATABASE_URL");
        expect(read("supportDatabase.server.ts")).not.toContain("OBSERVABILITY_DASHBOARD_DATABASE_URL");
        expect(read("database.server.ts")).not.toContain("SUPPORT_");
    });
    it("never injects untrusted HTML", () => {
        for (const file of files(path.resolve("src")).filter(item => /\.tsx?$/.test(item) && !item.endsWith(".test.tsx") && !item.endsWith(".test.ts"))) {
            expect(readFileSync(file, "utf8"), file).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
        }
    });
    it("keeps the support pages server-rendered and dynamic", () => {
        for (const file of ["src/app/support/page.tsx", "src/app/support/[id]/page.tsx"]) {
            const source = readFileSync(path.resolve(file), "utf8");
            expect(source).toContain('export const dynamic = "force-dynamic"');
            expect(source).not.toContain('"use client"');
        }
    });
});
