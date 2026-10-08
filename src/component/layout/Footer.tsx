export function Footer() {
    return (
        <div className="px-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 text-sm text-[var(--text-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p>
                    © 2026 iworkhere.space created by dailephd LLC
                </p>
                <a href="/privacy" className="w-fit rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]">
                    Privacy Policy
                </a>
            </div>
        </div>
    );
}
