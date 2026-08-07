import type { ReactNode } from "react";

interface AdBannerVerticalProps {
    label: string;
    children?: ReactNode;
    isPlaceholder?: boolean;
}

export function AdBannerVertical({ label, children, isPlaceholder }: AdBannerVerticalProps) {
    return (
        <aside
            className="flex w-56 flex-col gap-3 rounded-[14px] border border-border bg-surface-alt p-4"
            aria-label={label}
        >
            <div className="text-xs font-semibold text-text-muted">
                {label}
            </div>
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center">
                {isPlaceholder ? (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-text-secondary">Ad space</span>
                        <p className="text-xs text-text-muted">
                            Reserved vertical placement
                        </p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </aside>
    );
}
