import "server-only";
import { dashboardLink, failure, PROVIDER_TIMEOUT_MS, statusFailure, transportFailure, type DeliveryPayload, type ProviderResult } from "./provider.server";

export interface GithubConfig {
    token: string | undefined;
    repository: string | undefined;
    apiUrl: string;
    dashboardBase: string | undefined;
    fetch: typeof fetch;
}

/** The public application repository is never an automatic support destination. */
const FORBIDDEN_REPOSITORY = "dailephd/iworkhere.space";
const REPOSITORY = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const ISSUE_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/issues\/[0-9]+$/;
const MAX_RECONCILE_PAGE = 5;

export function defaultGithubConfig(): GithubConfig {
    return {
        token: process.env.SUPPORT_GITHUB_TOKEN,
        repository: process.env.SUPPORT_GITHUB_REPOSITORY,
        apiUrl: process.env.SUPPORT_GITHUB_API_URL || "https://api.github.com",
        dashboardBase: process.env.SUPPORT_DASHBOARD_BASE_URL,
        fetch,
    };
}

export function issueMarker(reportId: string): string {
    return `<!-- support-report:${reportId} -->`;
}

/** Private issue content: reference, category, area, route, link and time only. No report text or address. */
export function issueBody(payload: DeliveryPayload, dashboardBase: string | undefined): string {
    const link = dashboardLink(payload.reportId, dashboardBase);
    return [
        `Report: ${payload.reportId}`,
        `Category: ${payload.category}`,
        `Area: ${payload.toolId ? `tool ${payload.toolId}` : payload.area}`,
        `Route: ${payload.pathname}`,
        `Received: ${payload.receivedAt}`,
        link ? `Triage: ${link}` : "Triage: dashboard link not configured",
        "",
        issueMarker(payload.reportId),
    ].join("\n");
}

interface IssueItem { number?: unknown; html_url?: unknown; body?: unknown; pull_request?: unknown }

function headers(config: GithubConfig): Record<string, string> {
    return { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "iworkhere-support" };
}

async function call(config: GithubConfig, path: string, init: RequestInit = {}): Promise<Response> {
    return config.fetch(`${config.apiUrl}${path}`, { ...init, headers: { ...headers(config), ...(init.body ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS), cache: "no-store" });
}

function issueResult(item: IssueItem): ProviderResult | null {
    if (typeof item.number !== "number" || typeof item.html_url !== "string" || !ISSUE_URL.test(item.html_url)) return null;
    return { ok: true, providerRef: `issue:${item.number}`, issueNumber: item.number, issueUrl: item.html_url };
}

/**
 * Reconcile-then-create. An uncertain earlier creation (timeout) is found again through the
 * opaque report marker, so a retry never opens a second issue for the same report.
 */
export async function createPrivateIssue(payload: DeliveryPayload, config: GithubConfig = defaultGithubConfig()): Promise<ProviderResult> {
    if (!config.token || !config.repository || !REPOSITORY.test(config.repository)) return failure("misconfigured");
    if (config.repository.toLowerCase() === FORBIDDEN_REPOSITORY) return failure("not_private");
    try {
        const repo = await call(config, `/repos/${config.repository}`);
        if (!repo.ok) return statusFailure(repo.status);
        if ((await repo.json() as { private?: unknown }).private !== true) return failure("not_private");

        const marker = issueMarker(payload.reportId);
        const since = new Date(new Date(payload.receivedAt).getTime() - 60_000).toISOString();
        for (let page = 1; page <= MAX_RECONCILE_PAGE; page++) {
            const list = await call(config, `/repos/${config.repository}/issues?state=all&since=${encodeURIComponent(since)}&per_page=100&page=${page}`);
            if (!list.ok) return statusFailure(list.status);
            const items = await list.json() as IssueItem[];
            const match = items.find(item => !item.pull_request && typeof item.body === "string" && item.body.includes(marker));
            if (match) return issueResult(match) ?? failure("unknown");
            if (items.length < 100) break;
        }

        const created = await call(config, `/repos/${config.repository}/issues`, {
            method: "POST",
            body: JSON.stringify({ title: `[Support] ${payload.reportId} ${payload.category}`, body: issueBody(payload, config.dashboardBase), labels: ["new"] }),
        });
        if (!created.ok) return statusFailure(created.status);
        return issueResult(await created.json() as IssueItem) ?? failure("unknown");
    } catch (error) {
        return transportFailure(error);
    }
}
