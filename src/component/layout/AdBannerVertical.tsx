import type { ReactNode } from "react";

interface AdBannerVerticalProps {
    label: string;
    children?: ReactNode;
    isPlaceholder?: boolean;
}

export function AdBannerVertical({ label, children, isPlaceholder }: AdBannerVerticalProps) {
    return (
        <aside
            className="flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:w-64"
            aria-label={label}
        >
            <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {label}
            </div>
            <div className="flex min-h-[clamp(300px,40vh,600px)] flex-col items-center justify-center gap-2 text-center">
                {isPlaceholder ? (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-text">Ad space</span>
                        <p className="text-xs text-text-muted">
                            Place for a vertical banner
                        </p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </aside>
    );
}
