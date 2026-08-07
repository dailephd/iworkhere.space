import Link from "next/link";
import { ThemeToggle } from "@/component/common/ThemeToggle";
import { Input } from "@/component/common/Input";

export function Header() {
    return (
        <div className="flex h-16 items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center">
                <Link
                    href="/"
                    className="rounded-[10px] text-lg font-bold tracking-tight text-text transition-colors hover:text-[var(--brand-primary)]"
                >
                    iworkhere.space
                </Link>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
                <div className="hidden w-full max-w-sm sm:block">
                    <label className="sr-only" htmlFor="header-tool-search">
                        Search tools
                    </label>
                    <Input
                        id="header-tool-search"
                        type="search"
                        placeholder="Search tools..."
                        className="h-10 min-h-10 bg-surface-alt text-sm"
                    />
                </div>
                <ThemeToggle />
            </div>
        </div>
    );
}
