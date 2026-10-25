import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "About",
    description: "Learn about iworkhere.space, its browser-based tools for files and data, local processing, and the company behind the site.",
    canonicalPath: "/about",
});

const linkStyle = "rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

export default function AboutPage() {
    return (
        <article className="max-w-3xl space-y-8 text-text [&_p]:leading-7">
            <header className="space-y-3">
                <h1 className="text-2xl font-semibold">About iworkhere.space</h1>
                <p>iworkhere.space brings together practical online tools for working with files, text, and data. Whether you need to combine PDF files, resize an image, extract text from HTML, format JSON, or convert measurements, you can handle these tasks directly in your browser without installing separate software.</p>
            </header>

            <section aria-labelledby="about-tools" className="space-y-3">
                <h2 id="about-tools" className="text-xl font-semibold">Tools designed for everyday work</h2>
                <p>Each tool is built around a specific task, with a straightforward interface and the controls needed to get the job done. The collection covers PDF documents, images, text, calculations, unit conversions, and developer utilities.</p>
                <p>Our focus is on making common operations easy to complete without unnecessary complexity. When a tool has specific requirements or limitations, such as supported file formats, size restrictions, or output options, you can find that information alongside the tool itself.</p>
                <p>Explore the complete collection on the <Link className={linkStyle} href="/discover">All tools</Link> page.</p>
            </section>

            <section aria-labelledby="about-browser" className="space-y-3">
                <h2 id="about-browser" className="text-xl font-semibold">Working in your browser</h2>
                <p>The PDF, image, text, JSON, and QR code utilities process their inputs directly in your browser rather than uploading them to our servers for processing. This allows you to work with files and text on your own device.</p>
                <p>The website also uses services for hosting, analytics, and communication. Our <Link className={linkStyle} href="/privacy">Privacy Policy</Link> explains how these services handle information and how browser storage is used.</p>
            </section>

            <section aria-labelledby="about-publisher" className="space-y-3">
                <h2 id="about-publisher" className="text-xl font-semibold">About the publisher</h2>
                <p>iworkhere.space is developed and maintained by dailephd LLC. We continue to improve existing utilities and develop new ones, with an emphasis on practical functionality, clear interfaces, and accurate guidance.</p>
                <p>If you encounter a problem, have feedback, or would like to suggest a tool, please <Link className={linkStyle} href="/contact">contact us</Link>.</p>
            </section>
        </article>
    );
}
