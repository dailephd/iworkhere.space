import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
    title: "Privacy Policy",
    description: "How iworkhere.space handles tool inputs, local storage, site measurements, diagnostics, analytics and advertising choices.",
    canonicalPath: "/privacy",
});

const linkStyle = "rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

export default function PrivacyPage() {
    return (
        <article className="max-w-3xl space-y-8 text-text [&_p]:leading-7">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold">Privacy Policy</h1>
                <p className="text-sm text-text-muted">Last updated: October 8, 2026</p>
                <p>This policy explains information processing on iworkhere.space, including its browser tools and the services used to operate and improve the website.</p>
            </header>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Tool inputs and local processing</h2>
                <p>The current image, PDF, text, JSON and QR code tools process selected files and entered content in your browser. Their processing does not upload those files or content to our servers. Tool inputs, filenames and generated results are excluded from our application analytics and diagnostic reporting.</p>
                <p>Some tools can put settings or values in the page URL. For example, the calculator includes its expression in URL query parameters. URLs may be kept in browser history, sent when a page is requested, or disclosed when you share a link. Avoid sensitive information in shareable URLs. Our analytics remove query strings and fragments from the page URL they report.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Browser storage and offline use</h2>
                <p>We use local storage on your device to remember your theme and up to ten recently used tool names. These preferences do not contain tool inputs or results. The website also caches pages and static resources in your browser for offline use; cached page addresses can include URL parameters.</p>
                <p>You can remove these preferences and offline caches using your browser’s controls for clearing this site’s data. Blocking local storage may prevent preferences from being remembered. Our application measurements do not use tracking cookies.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Site measurements and diagnostics</h2>
                <p>We collect first-party measurements to understand tool usage, navigation, performance and reliability. Requests to /api/metric can contain a timestamp, page pathname, tool identifier, actions such as opening a tool or copying a result, navigation type, referring website hostname, performance measurements and categorical error information. Optional device categories are based on browser viewport width.</p>
                <p>Technical logs sent to /api/log and server error reports help diagnose failures. They can include timestamps, page paths, tool identifiers, bounded error messages and stack traces, error grouping identifiers, browser user-agent, viewport dimensions, pixel ratio, online and visibility status, and technical runtime or deployment context. Messages and stack locations are bounded and redacted to reduce exposure of secrets; arbitrary input and file data are excluded.</p>
                <p>Accepted measurements and logs are processed by our hosting service, Vercel. When database persistence is enabled, selected measurement fields and diagnostic records are stored in Neon. Application telemetry excludes IP addresses, cookies, authentication data, entered content, files, generated output and full page URLs with query strings or fragments. Network and hosting providers still process connection information, including IP addresses, to deliver and protect the service.</p>
                <p>Our database maintenance removes raw measurement records older than 90 days after their daily aggregation is complete; unaggregated records are retained until processed. Daily aggregate history is retained indefinitely. Detailed database diagnostics are removed after 30 days. These database rules do not set the retention of hosting logs or Vercel Analytics, which are governed by the respective service’s configuration and policies.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Vercel Web Analytics and service providers</h2>
                <p>We use Vercel Web Analytics for page views and client navigation. Our integration removes query strings and fragments from the page URL before sending it and does not send custom tool events to Vercel Analytics. Vercel may process the page address, referrer, timestamp, approximate location, operating system, browser and device type for traffic statistics. Vercel describes this service as using a request-derived visitor hash rather than third-party cookies, with visitor sessions discarded after 24 hours.</p>
                <p>Read <a className={linkStyle} href="https://vercel.com/docs/analytics/privacy-policy">Vercel’s Web Analytics privacy documentation</a>, <a className={linkStyle} href="https://vercel.com/legal/privacy-policy">Vercel’s Privacy Policy</a> and <a className={linkStyle} href="https://neon.com/privacy-policy">Neon’s Privacy Policy</a> for information about these providers. Following external links connects you to those services under their own policies.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Google advertising and your choices</h2>
                <p>Google AdSense ad serving is currently disabled on this website. Active site analytics are separate from advertising. The following describes advertising practices that would apply if Google ads are enabled.</p>
                <p>Third-party vendors, including Google, use advertising cookies to serve ads based on your prior visits to this website or other websites. Google’s advertising cookies allow Google and its partners to personalize ads based on visits to this site and other sites on the Internet. Other participating advertising vendors or networks may also use cookies when serving ads.</p>
                <p>You can manage or opt out of Google personalized advertising through <a className={linkStyle} href="https://adssettings.google.com/">Google Ad Settings</a>. You can also visit <a className={linkStyle} href="https://www.aboutads.info/">aboutads.info</a> for choices concerning participating third-party vendors’ use of cookies for personalized advertising. These choices do not necessarily stop all advertising or all cookies. See <a className={linkStyle} href="https://policies.google.com/technologies/ads">Google’s advertising information</a> for more detail.</p>
                <p>This policy does not itself collect consent. Advertising activation requires the applicable consent and privacy controls, including a Google-certified consent management platform for personalized ads in the EEA, United Kingdom and Switzerland. Disclosures about participating vendors must be kept current when advertising is activated.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Your browser choices and policy updates</h2>
                <p>Your browser lets you control cookies, local storage and cached data. You may also use browser privacy controls or content blockers to limit analytics requests; their effects depend on your browser and settings. Clearing local data does not delete measurements already received by our service providers.</p>
                <p>We will update this page when the practices described here change. The date above identifies the latest policy update.</p>
            </section>
        </article>
    );
}
