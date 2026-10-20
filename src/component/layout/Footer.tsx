import type { ReactNode } from "react";

export interface FooterProps {
    /** Optional presentation slot for a site-wide action; the footer owns no action logic. */
    action?: ReactNode;
}

export function Footer({ action }: FooterProps = {}) {
    return (
        <div data-footer-inset className="px-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-1 text-sm text-[var(--text-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p data-footer-detail>
                    © 2026 iworkhere.space created by dailephd LLC
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {action}
                    <a href="/privacy" data-footer-detail className="w-fit rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]">
                        Privacy Policy
                    </a>
                </div>
            </div>
        </div>
    );
}
