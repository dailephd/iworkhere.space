"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
    return <main id="main"><section className="panel"><h1>Dashboard unavailable</h1><p role="alert">The server requires a configured dashboard database connection and access to the observability schema. No metrics could be loaded.</p><p>Check server configuration and database availability, then retry.</p><button onClick={reset}>Retry</button></section></main>;
}
