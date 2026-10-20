import Link from "next/link";
import { ageLabel, ageMinutes, safeIssueUrl, type SupportDetailData, type SupportHealthRow, type SupportListData } from "../lib/supportModel";

/** Every value below is untrusted text rendered through React escaping; nothing is injected as markup. */
function areaLabel(row: { area: string; tool_id: string | null }): string {
    return row.tool_id ? `Tool: ${row.tool_id}` : row.area === "other" ? "Other" : "Site-wide";
}

export function SupportHealthPanel({ health, now }: { health: SupportHealthRow; now: Date }) {
    const oldest = ageMinutes(health.oldest_pending_at, now);
    return <section className="panel" aria-labelledby="delivery-health">
        <h2 id="delivery-health">Delivery health</h2>
        <p className="muted">Counts across all private delivery jobs (issue creation, operator email and contact receipts).</p>
        <dl>
            <div><dt>Undelivered</dt><dd>{health.undelivered_count.toLocaleString("en-US")}</dd></div>
            <div><dt>Retrying</dt><dd>{health.retrying_count.toLocaleString("en-US")}</dd></div>
            <div><dt>Failing (attempted, not delivered)</dt><dd>{health.failing_count.toLocaleString("en-US")}</dd></div>
            <div><dt>Dead-lettered</dt><dd>{health.dead_count.toLocaleString("en-US")}</dd></div>
            <div><dt>Oldest pending age</dt><dd>{ageLabel(oldest)}</dd></div>
        </dl>
        {health.dead_count > 0 ? <p role="alert">Dead-lettered jobs need operator attention; reports remain stored.</p> : null}
    </section>;
}

export function SupportListView({ data, page, now }: { data: SupportListData; page: number; now: Date }) {
    return <main id="main">
        <header className="dashboard-header">
            <div><p className="eyebrow">iworkhere.space</p><h1>User reports</h1></div>
            <nav aria-label="Dashboard sections"><Link href="/">Observability overview</Link></nav>
        </header>
        <SupportHealthPanel health={data.health} now={now} />
        <section className="panel" aria-labelledby="reports">
            <h2 id="reports">Reports</h2>
            <p className="muted">Newest first. Open a report to read its text. Access to this dashboard is protected by the deployment, not by the application.</p>
            {data.report.length === 0 ? <p className="empty">No reports yet</p> : <div className="table-scroll" role="region" aria-label="Reports table" tabIndex={0}>
                <table><thead><tr><th scope="col">Reference</th><th scope="col">Received (UTC)</th><th scope="col">Category</th><th scope="col">Area</th><th scope="col">Page</th><th scope="col">Delivery</th></tr></thead>
                    <tbody>{data.report.map(row => <tr key={row.id}>
                        <th scope="row"><a href={`/support/${row.id}`}>{row.id}</a></th>
                        <td>{row.received_at}</td><td>{row.category}</td><td>{areaLabel(row)}</td><td>{row.pathname}</td>
                        <td>{row.dead_job_count > 0 ? `${row.dead_job_count} dead-lettered` : row.undelivered_job_count > 0 ? `${row.undelivered_job_count} pending` : "Delivered"}{row.has_tracker ? " · issue linked" : ""}</td>
                    </tr>)}</tbody></table></div>}
            <nav aria-label="Pagination" className="range">
                {page > 1 ? <a href={`?page=${page - 1}`}>Newer</a> : null}
                {data.hasNext ? <a href={`?page=${page + 1}`}>Older</a> : null}
            </nav>
        </section>
    </main>;
}

function Narrative({ title, value, purgedAt }: { title: string; value: string | null; purgedAt: string | null }) {
    return <section className="panel"><h2>{title}</h2>
        {value ? <pre className="narrative">{value}</pre> : <p className="muted">{purgedAt ? `Removed by retention at ${purgedAt}` : "Not supplied"}</p>}
    </section>;
}

export function SupportDetailView({ data, now }: { data: SupportDetailData; now: Date }) {
    const { report, job } = data;
    const issue = safeIssueUrl(report.tracker_issue_url);
    return <main id="main">
        <header className="dashboard-header">
            <div><p className="eyebrow">User report</p><h1>{report.id}</h1></div>
            <nav aria-label="Dashboard sections"><Link href="/support">All reports</Link></nav>
        </header>
        <section className="panel" aria-labelledby="summary">
            <h2 id="summary">Summary</h2>
            <dl>
                <div><dt>Received (UTC)</dt><dd>{report.received_at}</dd></div>
                <div><dt>Category</dt><dd>{report.category}</dd></div>
                <div><dt>Affected area</dt><dd>{areaLabel(report)}</dd></div>
                <div><dt>Page</dt><dd>{report.pathname}</dd></div>
                <div><dt>Private issue</dt><dd>{issue ? <a href={issue} rel="noopener noreferrer">{issue}</a> : "Not created yet"}</dd></div>
                <div><dt>Contact</dt><dd>{report.contact_consent ? (report.contact_email ?? (report.contact_purged_at ? `Removed by retention at ${report.contact_purged_at}` : "Not supplied")) : "No consent to contact"}</dd></div>
            </dl>
        </section>
        <Narrative title="Description" value={report.description} purgedAt={report.narrative_purged_at} />
        <Narrative title="Expected behavior / improvement" value={report.expected} purgedAt={report.narrative_purged_at} />
        <Narrative title="Observed behavior / example / use case" value={report.observed} purgedAt={report.narrative_purged_at} />
        <section className="panel" aria-labelledby="delivery">
            <h2 id="delivery">Delivery</h2>
            <div className="table-scroll"><table><thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Last failure</th><th scope="col">Next attempt (UTC)</th><th scope="col">Delivered (UTC)</th><th scope="col">Age</th></tr></thead>
                <tbody>{job.map(item => <tr key={item.kind}>
                    <th scope="row">{item.kind}</th><td>{item.status}</td><td>{item.attempt_count}</td><td>{item.failure_code ?? "—"}</td>
                    <td>{item.status === "pending" || item.status === "leased" ? item.next_attempt_at : "—"}</td><td>{item.delivered_at ?? "—"}</td>
                    <td>{item.status === "delivered" || item.status === "dead" ? "—" : ageLabel(ageMinutes(report.received_at, now))}</td>
                </tr>)}</tbody></table></div>
        </section>
    </main>;
}
