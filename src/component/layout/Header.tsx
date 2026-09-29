import Link from "next/link";
import { ThemeToggle } from "@/component/common/ThemeToggle";

export function Header() {
    return (
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-8">
                <Link
                    href="/"
                    className="text-lg font-bold tracking-tight text-[var(--text)] hover:opacity-80"
                >
                    Utility Platform
                </Link>
            </div>

            <div className="flex flex-1 items-center justify-end gap-4">
                <div className="relative hidden w-full max-w-sm sm:block">
                    <input
                        type="search"
                        placeholder="Search tools..."
                        className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                </div>
                <ThemeToggle />
            </div>
        </div>
    );
}
