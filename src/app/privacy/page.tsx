import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Privacy Policy",
    description: "How iworkhere.space handles tool inputs, local storage, site measurements, diagnostics, analytics and advertising choices.",
    canonicalPath: "/privacy",
});

const linkStyle = "rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

/* scroll-mt clears the fixed header; tabIndex -1 lets an in-page link move keyboard focus to the section heading. */
const headingClass = "scroll-mt-24 text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

const sectionList = [
    { id: "privacy-tool-inputs", title: "Tool inputs and local processing" },
    { id: "privacy-browser-storage", title: "Browser storage and offline use" },
    { id: "privacy-measurements", title: "Site measurements and diagnostics" },
    { id: "privacy-reports", title: "Problem reports and suggestions" },
    { id: "privacy-contact", title: "Contact Us messages" },
    { id: "privacy-providers", title: "Vercel Web Analytics and service providers" },
    { id: "privacy-advertising", title: "Google advertising and your choices" },
    { id: "privacy-choices", title: "Your browser choices and policy updates" },
];

export default function PrivacyPage() {
    return (
        <article className="max-w-3xl space-y-8 text-text [&_p]:leading-7">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">Privacy Policy</h1>
                <p className="text-sm text-text-muted">Last updated: October 27, 2026</p>
                <p>This policy explains information processing on iworkhere.space, including its browser tools and the services used to operate and improve the website.</p>
            </header>

            <nav aria-label="On this page" className="space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
                <p className="text-sm font-semibold text-text">On this page</p>
                <ol className="list-decimal space-y-1 pl-5">
                    {sectionList.map((section) => (
                        <li key={section.id}><a className={linkStyle} href={`#${section.id}`}>{section.title}</a></li>
                    ))}
                </ol>
            </nav>

            <section className="space-y-3">
                <h2 id="privacy-tool-inputs" tabIndex={-1} className={headingClass}>Tool inputs and local processing</h2>
                <p>The current image, PDF, text, JSON and QR code tools process selected files and entered content in your browser. Their processing does not upload those files or content to our servers. Tool inputs, filenames and generated results are excluded from our application analytics and diagnostic reporting.</p>
                <p>Some tools can put settings or values in the page URL. For example, the calculator includes its expression in URL query parameters. URLs may be kept in browser history, sent when a page is requested, or disclosed when you share a link. Avoid sensitive information in shareable URLs. Our analytics remove query strings and fragments from the page URL they report.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-browser-storage" tabIndex={-1} className={headingClass}>Browser storage and offline use</h2>
                <p>We use local storage on your device to remember your theme and up to ten recently used tool names. These preferences do not contain tool inputs or results. The website also keeps eligible pages and static resources in your browser’s cache for offline use. It caches only page addresses without URL parameters and excludes requests that include query strings, so URL state such as a calculator expression is not stored in that cache.</p>
                <p>You can remove these preferences and offline caches using your browser’s controls for clearing this site’s data. Blocking local storage may prevent preferences from being remembered. Our application measurements do not use tracking cookies.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-measurements" tabIndex={-1} className={headingClass}>Site measurements and diagnostics</h2>
                <p>We collect first-party measurements to understand tool usage, navigation, performance and reliability. Requests to /api/metric can contain a timestamp, page pathname, tool identifier, actions such as opening a tool or copying a result, navigation type, referring website hostname, performance measurements and categorical error information. Optional device categories are based on browser viewport width.</p>
                <p>Technical logs sent to /api/log and server error reports help diagnose failures. They can include timestamps, page paths, tool identifiers, bounded error messages and stack traces, error grouping identifiers, browser user-agent, viewport dimensions, pixel ratio, online and visibility status, and technical runtime or deployment context. Messages and stack locations are bounded and redacted to reduce exposure of secrets; arbitrary input and file data are excluded.</p>
                <p>Accepted measurements and logs are processed by our hosting service, Vercel. When database persistence is enabled, selected measurement fields and diagnostic records are stored in Neon. Application telemetry excludes IP addresses, cookies, authentication data, entered content, files, generated output and full page URLs with query strings or fragments. Network and hosting providers still process connection information, including IP addresses, to deliver and protect the service.</p>
                <p>Our database maintenance removes raw measurement records older than 90 days after their daily aggregation is complete; unaggregated records are retained until processed. Daily aggregate history is retained indefinitely. Detailed database diagnostics are removed after 30 days. These database rules do not set the retention of hosting logs or Vercel Analytics, which are governed by the respective service’s configuration and policies.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-reports" tabIndex={-1} className={headingClass}>Problem reports and suggestions</h2>
                <p>When the report form is available, you can send a voluntary report or suggestion from any page. It asks for a category, the affected tool or area and a description, and can include optional expected-behavior or example text. An email address is stored only if you enter one and tick the box that allows us to contact you. We attach the page path without query strings or fragments. We do not ask for files, screenshots, tool inputs or results, and the form asks you not to include passwords, secrets or private records.</p>
                <p>Reports are sent to a dedicated endpoint, not to the measurement and diagnostic services described above, and are stored separately in our Neon database. We open a private tracker entry in GitHub and send an operator notification through Resend; both contain only the report reference, category, tool or page and a secure triage link. Your report text and email address are not copied into GitHub or into the operator notification. If you provide an address and consent, we send a receipt through Resend. Cloudflare Turnstile checks that a submission is not automated; we verify its token and do not store it with your report.</p>
                <p>Our retention targets are to remove report text 180 days after it is received and to remove contact addresses no later than 90 days after our last correspondence with you. These targets are not yet a completed deletion practice; we activate removal separately and will update this page when it is in effect. Read <a className={linkStyle} href="https://www.cloudflare.com/privacypolicy/">Cloudflare’s Privacy Policy</a>, <a className={linkStyle} href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub’s Privacy Statement</a> and <a className={linkStyle} href="https://resend.com/legal/privacy-policy">Resend’s Privacy Policy</a> for information about these providers.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-contact" tabIndex={-1} className={headingClass}>Contact Us messages</h2>
                <p>You can send a voluntary message from the Contact Us page. The form requires your email address, a title and your message, so a message sent this way is not anonymous. It does not ask for files or screenshots, and you should not include passwords, secrets or private records.</p>
                <p>When you submit the form, those values are sent to our server, which passes them to Resend, an email delivery provider, to deliver the message to the site operator’s email inbox. Your email address is set as the reply address. We use the message to read and respond to your inquiry. Like every request, the submission passes through our hosting service, Vercel.</p>
                <p>Contact messages are separate from problem reports and from site measurements and diagnostics. They are not stored in the problem-report database, are not opened as GitHub issues, and are not sent to our analytics or logs. Unlike the browser tools, the message you write leaves your device when you submit it.</p>
                <p>Once delivered, a message exists as an email in the operator’s inbox and in Resend’s delivery records. We have not set a deletion schedule for contact messages, and the retention targets for problem reports do not apply to them. How long Resend and the inbox provider keep messages follows their own policies and settings, and we cannot guarantee deletion at a particular time. Read <a className={linkStyle} href="https://resend.com/legal/privacy-policy">Resend’s Privacy Policy</a> for information about this provider.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-providers" tabIndex={-1} className={headingClass}>Vercel Web Analytics and service providers</h2>
                <p>We use Vercel Web Analytics for page views and client navigation. Our integration removes query strings and fragments from the page URL before sending it and does not send custom tool events to Vercel Analytics. Vercel may process the page address, referrer, timestamp, approximate location, operating system, browser and device type for traffic statistics. Vercel describes this service as using a request-derived visitor hash rather than third-party cookies, with visitor sessions discarded after 24 hours.</p>
                <p>Read <a className={linkStyle} href="https://vercel.com/docs/analytics/privacy-policy">Vercel’s Web Analytics privacy documentation</a>, <a className={linkStyle} href="https://vercel.com/legal/privacy-policy">Vercel’s Privacy Policy</a> and <a className={linkStyle} href="https://neon.com/privacy-policy">Neon’s Privacy Policy</a> for information about these providers. Following external links connects you to those services under their own policies.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-advertising" tabIndex={-1} className={headingClass}>Google advertising and your choices</h2>
                <p>Google AdSense ad serving is currently disabled on this website. Active site analytics are separate from advertising. The following describes advertising practices that would apply if Google ads are enabled.</p>
                <p>Third-party vendors, including Google, use advertising cookies to serve ads based on your prior visits to this website or other websites. Google’s advertising cookies allow Google and its partners to personalize ads based on visits to this site and other sites on the Internet. Other participating advertising vendors or networks may also use cookies when serving ads.</p>
                <p>You can manage or opt out of Google personalized advertising through <a className={linkStyle} href="https://adssettings.google.com/">Google Ad Settings</a>. You can also visit <a className={linkStyle} href="https://www.aboutads.info/">aboutads.info</a> for choices concerning participating third-party vendors’ use of cookies for personalized advertising. These choices do not necessarily stop all advertising or all cookies. See <a className={linkStyle} href="https://policies.google.com/technologies/ads">Google’s advertising information</a> for more detail.</p>
                <p>This policy does not itself collect consent. Advertising activation requires the applicable consent and privacy controls, including a Google-certified consent management platform for personalized ads in the EEA, United Kingdom and Switzerland. Disclosures about participating vendors must be kept current when advertising is activated.</p>
            </section>

            <section className="space-y-3">
                <h2 id="privacy-choices" tabIndex={-1} className={headingClass}>Your browser choices and policy updates</h2>
                <p>Your browser lets you control cookies, local storage and cached data. You may also use browser privacy controls or content blockers to limit analytics requests; their effects depend on your browser and settings. Clearing local data does not delete measurements already received by our service providers.</p>
                <p>We will update this page when the practices described here change. The date above identifies the latest policy update.</p>
            </section>
        </article>
    );
}
