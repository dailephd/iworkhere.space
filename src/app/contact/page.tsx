import Link from "next/link";
import { ContactForm } from "@/component/contact/ContactForm";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteInformation } from "@/module/content/siteInformation";

export const metadata = buildPageMetadata({
    title: "Contact Us",
    description: "Send a general question or comment to the iworkhere.space operator by email, and learn how it differs from reporting a problem with a tool.",
    canonicalPath: "/contact",
});

const linkStyle = "rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

export default function ContactPage() {
    // The footer Report Issues control exists only when the same flag that renders it in the root layout is on.
    const { contact } = getSiteInformation({ reportControlVisible: process.env.NEXT_PUBLIC_SUPPORT_ENABLED === "true" });

    return (
        <article className="max-w-3xl space-y-8 text-text [&_p]:leading-7">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">Contact Us</h1>
                <p>{contact.purpose}</p>
                <p>{contact.reportDistinction}</p>
            </header>

            <section aria-labelledby="contact-form-heading" className="space-y-3">
                <h2 id="contact-form-heading" className="text-xl font-semibold">Send a message</h2>
                <p className="text-sm text-text-muted">Sending a message requires JavaScript. Please do not include passwords, secret tokens or private documents. We do not promise a reply by a particular time.</p>
                <ContactForm />
            </section>

            <section aria-labelledby="contact-privacy-heading" className="space-y-3">
                <h2 id="contact-privacy-heading" className="text-xl font-semibold">What happens to your message</h2>
                <p>Your message is sent through Resend to the operator&apos;s email inbox and is not stored in a site database or in the problem-report system. See the <Link className={linkStyle} href="/privacy">Privacy Policy</Link> for details, or learn <Link className={linkStyle} href="/about">about the site</Link>.</p>
            </section>
        </article>
    );
}
