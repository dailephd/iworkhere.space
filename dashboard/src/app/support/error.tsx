"use client";

export default function SupportError({ reset }: { reset: () => void }) {
    return <main id="main"><section className="panel"><h1>User reports unavailable</h1><p role="alert">The server requires a configured support dashboard database connection with read access to the support schema. No reports could be loaded.</p><p>Check server configuration and database availability, then retry.</p><button onClick={reset}>Retry</button></section></main>;
}
