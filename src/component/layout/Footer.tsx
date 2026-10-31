import type { ReactNode } from "react";

export interface FooterProps {
    /** Optional presentation slot for a site-wide action; the footer owns no action logic. */
    action?: ReactNode;
}

// Quiet links: no permanent underline (hover only), a 24px minimum target and the standard keyboard focus ring.
const quietLink = "inline-flex min-h-6 w-fit items-center rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]";

export function Footer({ action }: FooterProps = {}) {
    return (
        <div data-footer-inset className="px-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-[var(--text-muted)]">
                <p>
                    © 2026 iworkhere.space created by dailephd LLC
                </p>
                {/* One compact horizontal group, like the header: About, Contact Us, then the optional report action, then Privacy Policy. */}
                <div data-footer-actions className="flex flex-wrap items-center gap-x-4">
                    <a href="/about" className={quietLink}>
                        About
                    </a>
                    <a href="/contact" className={quietLink}>
                        Contact Us
                    </a>
                    {action}
                    <a href="/privacy" className={quietLink}>
                        Privacy Policy
                    </a>
                </div>
            </div>
        </div>
    );
}
