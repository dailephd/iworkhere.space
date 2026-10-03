import type { CountItem, DashboardModel, SeriesPoint } from "../lib/model";
import { RANGE, type RangePlan } from "../lib/range";

export interface DashboardViewProp { model: DashboardModel; plan: RangePlan }
interface CountTableProp { title: string; item: CountItem[]; description?: string }
function CountTable({ title, item, description }: CountTableProp) {
    return <section className="panel"><h2>{title}</h2>{description && <p className="muted">{description}</p>}
        {item.length === 0 ? <p className="empty">No data yet</p> : <div className="table-scroll"><table><thead><tr><th scope="col">{title === "Referrers" ? "Hostname" : "Name"}</th><th scope="col">Count</th></tr></thead>
            <tbody>{item.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.count.toLocaleString("en-US")}</td></tr>)}</tbody></table></div>}
    </section>;
}
function UsageChart({ point, granularity }: { point: SeriesPoint[]; granularity: string }) {
    if (point.length === 0) return <p className="empty">No data yet</p>;
    const maximum = Math.max(1, ...point.map(p => Math.max(p.navigations, p.executions)));
    const width = 1000, height = 180;
    const step = width / point.length;
    return <figure>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${granularity} navigation and tool execution counts in UTC`}>
            {point.map((p, i) => <g key={p.bin}>
                <rect className="navigation-bar" x={i * step + step * .1} y={height - height * p.navigations / maximum} width={step * .35} height={height * p.navigations / maximum}><title>{`${p.bin}: ${p.navigations} navigations`}</title></rect>
                <rect className="execution-bar" x={i * step + step * .5} y={height - height * p.executions / maximum} width={step * .35} height={height * p.executions / maximum}><title>{`${p.bin}: ${p.executions} executions`}</title></rect>
            </g>)}
        </svg>
        <div className="chart-label"><span>{point[0].bin.slice(0, 16).replace("T", " ")}</span><span>{point.at(-1)?.bin.slice(0, 16).replace("T", " ")}</span></div>
        <figcaption><span className="legend-navigation">Navigations</span> · <span className="legend-execution">Tool executions</span> · {granularity} bins · UTC · observed bins only</figcaption>
        <details><summary>View chart counts</summary><div className="table-scroll"><table><thead><tr><th scope="col">UTC bin</th><th scope="col">Navigations</th><th scope="col">Executions</th></tr></thead><tbody>{point.map(p => <tr key={p.bin}><th scope="row">{p.bin}</th><td>{p.navigations}</td><td>{p.executions}</td></tr>)}</tbody></table></div></details>
    </figure>;
}
export function DashboardView({ model, plan }: DashboardViewProp) {
    const card = [{ label: "Navigations", value: model.navigation }, { label: "Tool opens", value: model.opens }, { label: "Tool executions", value: model.executions }, { label: "Result copied", value: model.copied }];
    return <main id="main">
        <header className="dashboard-header"><div><p className="eyebrow">iworkhere.space · Operations</p><h1>Observability</h1><p className="muted">Application health, performance and tool activity</p></div><span className="badge">UTC</span></header>
        <nav aria-label="Time range" className="range">{RANGE.map(range => <a key={range} href={`?range=${range}`} aria-current={range === plan.range ? "page" : undefined}>{range === "all" ? "All time" : range}</a>)}</nav>
        <p className="muted source-note">{plan.source === "raw" ? "Exact recent counts from raw events." : "Completed daily aggregates plus the current incomplete UTC day. Counts reflect successfully rolled-up days; check freshness for maintenance gaps."}</p>
        {model.empty && <p className="notice" role="status">No data yet</p>}
        <section aria-labelledby="overview"><h2 id="overview">Overview</h2><div className="card-grid">{card.map(c => <article className="panel stat" key={c.label}><h3>{c.label}</h3><p>{model.empty ? "No data yet" : c.value.toLocaleString("en-US")}</p></article>)}</div></section>
        <section className="panel"><h2>Usage over time</h2><UsageChart point={model.series} granularity={plan.granularity} /></section>
        <section aria-labelledby="performance"><h2 id="performance">Performance</h2><p className="muted">{plan.source === "raw" ? "True p75 across raw samples in the selected range." : "Typical daily p75 = the unweighted median of retained daily route/viewport-group p75 values, including today's incomplete groups. This is not the full-range raw p75."}</p>
            <div className="vital-grid">{model.performance.filter(v => v.name !== "FID" || v.sampleCount > 0).map(v => <article className="panel stat" key={v.name}><h3>{v.name}</h3><p>{v.value === null ? "No data yet" : `${v.value.toLocaleString("en-US", { maximumFractionDigits: v.name === "CLS" ? 3 : 1 })}${v.name === "CLS" ? "" : " ms"}`}</p><small>{v.label} · {v.sampleCount.toLocaleString("en-US")} samples</small></article>)}</div>
        </section>
        <section className="panel"><h2>Tool usage</h2><p className="muted">Ranked by opens + executions + client errors. Mode changes are included in retained event counts.</p>{model.tool.length === 0 ? <p className="empty">No data yet</p> : <div className="table-scroll tool-table" role="region" aria-label="Tool usage table" tabIndex={0}><table><thead><tr><th scope="col">Tool</th><th scope="col">Opens</th><th scope="col">Executions</th><th scope="col">Errors</th></tr></thead><tbody>{model.tool.map(t => <tr key={t.name}><th scope="row">{t.name}</th><td>{t.opens}</td><td>{t.executions}</td><td>{t.errors}</td></tr>)}</tbody></table></div>}</section>
        <section aria-labelledby="reliability"><h2 id="reliability">Reliability</h2><div className="card-grid"><article className="panel stat"><h3>Client errors</h3><p>{model.empty ? "No data yet" : model.errors}</p></article><article className="panel stat"><h3>Failure count</h3><p>{model.empty ? "No data yet" : model.failureCount}</p><small>Each client-error is one failure; these two totals describe the same measurements.</small></article></div></section>
        <div className="breakdown-grid"><CountTable title="Top failure categories" item={model.failureCategory} /><CountTable title="Top failing routes" item={model.failingRoute} /><CountTable title="Top failing tools" item={model.failingTool} /><CountTable title="Routes" item={model.route} description="Top navigation paths; no landing-path or visitor inference." /><CountTable title="Referrers" item={model.referrer} description="Navigation hostnames only. No raw referrer URLs." /><CountTable title="Viewport class" item={model.device} description="Non-vital events: mobile <768px; tablet 768–1023px; desktop ≥1024px; missing/invalid width = unknown. Viewport width only." /></div>
        <section className="panel"><h2>Recent failures</h2><p className="muted">Latest 25 client errors in retained raw data within the selected range. Raw history is limited to 90 days.</p>{model.failure.length === 0 ? <p className="empty">No data yet</p> : <div className="table-scroll failure-table" role="region" aria-label="Recent failures table" tabIndex={0}><table><thead><tr><th scope="col">Received (UTC)</th><th scope="col">Path</th><th scope="col">Tool</th><th scope="col">Category</th><th scope="col">Viewport</th></tr></thead><tbody>{model.failure.map((f, i) => <tr key={`${f.occurred_at}-${i}`}><td>{f.occurred_at}</td><th scope="row">{f.pathname}</th><td>{f.tool_id ?? "—"}</td><td>{f.failure_category}</td><td>{f.device_class}</td></tr>)}</tbody></table></div>}</section>
        <section className="panel"><h2>Data freshness</h2><dl><div><dt>Last raw event received</dt><dd>{model.freshness.last_raw_received ?? "No data yet"}</dd></div><div><dt>Last completed rollup day</dt><dd>{model.freshness.last_rollup_day ?? "No data yet"}</dd></div></dl><p className="muted">No identity or session model is collected. AdSense and Search Console remain separate systems.</p></section>
    </main>;
}
