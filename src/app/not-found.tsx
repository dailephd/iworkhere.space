import type { Metadata } from "next";
import Link from "next/link";
import { buildBrowserTitle } from "@/lib/seo";

/** Missing pages use a descriptive browser title and are never indexed or listed in the sitemap. */
export const metadata: Metadata = {
    title: buildBrowserTitle("Page Not Found"),
    robots: { index: false, follow: false },
};

export default function NotFound() {
    return (
        <section className="max-w-3xl space-y-3 text-text [&_p]:leading-7">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p>This page could not be found. Browse the <Link className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]" href="/discover">All tools</Link> page to find a tool.</p>
        </section>
    );
}
