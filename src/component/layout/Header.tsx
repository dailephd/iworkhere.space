import Link from "next/link";
import { ThemeToggle } from "@/component/common/ThemeToggle";

export function Header() {
    return (
        <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
            <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-[var(--text)] hover:text-[var(--accent)]">
                iworkhere.space
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                <div className="relative hidden w-full max-w-sm sm:block">
                    <input
                        type="search"
                        aria-label="Search tools"
                        placeholder="Search tools..."
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                    />
                </div>
                <ThemeToggle />
            </div>
        </div>
    );
}
