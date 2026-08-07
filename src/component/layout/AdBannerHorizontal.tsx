import type { ReactNode } from "react";

interface AdBannerHorizontalProps {
    label: string;
    children?: ReactNode;
    isPlaceholder?: boolean;
}

export function AdBannerHorizontal({ label, children, isPlaceholder }: AdBannerHorizontalProps) {
    return (
        <aside
            className="flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            aria-label={label}
        >
            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted leading-none">
                {label}
            </div>
            <div className="flex min-h-[clamp(90px,12vw,135px)] items-center justify-center gap-4">
                {isPlaceholder ? (
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium text-text">Ad space</span>
                        <p className="text-xs text-text-muted">
                            Place for a horizontal banner
                        </p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </aside>
    );
}
