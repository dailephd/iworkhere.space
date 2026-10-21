import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteInformation } from "@/module/content/siteInformation";

export const metadata = buildPageMetadata({
    title: "About",
    description: "About iworkhere.space, a utility website maintained by dailephd LLC: what the browser tools do, how they are maintained and tested, and their limits.",
    canonicalPath: "/about",
});

const linkStyle = "rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

export default function AboutPage() {
    const site = getSiteInformation();

    return (
        <article className="max-w-3xl space-y-8 text-text [&_p]:leading-7">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">About {site.publisher.productName}</h1>
                <p>{site.purpose}</p>
            </header>

            <section aria-labelledby="about-publisher" className="space-y-3">
                <h2 id="about-publisher" className="text-xl font-semibold">Who publishes it</h2>
                <p>{site.publisher.productName} is published and maintained by {site.publisher.legalName}. The site currently has {site.toolCount} tools in {site.categoryCount} categories. You can browse them on the <Link className={linkStyle} href="/discover">All tools</Link> page.</p>
            </section>

            <section aria-labelledby="about-tools" className="space-y-3">
                <h2 id="about-tools" className="text-xl font-semibold">What the tools do</h2>
                <ul className="list-disc space-y-2 pl-6 leading-7">
                    {site.capability.map(item => (
                        <li key={item.id}><strong>{item.title}.</strong> {item.body}</li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="about-maintenance" className="space-y-3">
                <h2 id="about-maintenance" className="text-xl font-semibold">How it is maintained</h2>
                <ul className="list-disc space-y-2 pl-6 leading-7">
                    {site.maintenance.map(item => <li key={item}>{item}</li>)}
                </ul>
            </section>

            <section aria-labelledby="about-limits" className="space-y-3">
                <h2 id="about-limits" className="text-xl font-semibold">Limits</h2>
                <ul className="list-disc space-y-2 pl-6 leading-7">
                    {site.limitation.map(item => <li key={item}>{item}</li>)}
                </ul>
            </section>

            <section aria-labelledby="about-release" className="space-y-3">
                <h2 id="about-release" className="text-xl font-semibold">Release history</h2>
                <ul className="space-y-1 leading-7">
                    {site.release.map(item => (
                        <li key={item.version}><span className="font-medium">{item.version}</span> <span className="text-text-muted">({item.date})</span> — {item.title}</li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="about-contact" className="space-y-3">
                <h2 id="about-contact" className="text-xl font-semibold">Contact and privacy</h2>
                <p>{site.contact.purpose}</p>
                <p>Go to <Link className={linkStyle} href="/contact">Contact Us</Link> to send a message, or read the <Link className={linkStyle} href="/privacy">Privacy Policy</Link> to see how information is handled.</p>
            </section>
        </article>
    );
}
