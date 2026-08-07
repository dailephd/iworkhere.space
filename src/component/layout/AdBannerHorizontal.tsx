import type { ReactNode } from "react";

interface AdBannerHorizontalProps {
    label: string;
    children?: ReactNode;
    isPlaceholder?: boolean;
}

export function AdBannerHorizontal({ label, children, isPlaceholder }: AdBannerHorizontalProps) {
    return (
        <aside
            className="mx-auto flex min-h-12 w-full max-w-[1280px] items-center justify-between gap-4 rounded-[14px] border border-border bg-surface-alt px-5 py-2"
            aria-label={label}
        >
            <div className="text-xs font-semibold text-text-muted leading-4">
                {label}
            </div>
            <div className="flex items-center justify-end gap-4 text-right">
                {isPlaceholder ? (
                    <span className="text-xs text-text-muted">Ad space</span>
                ) : (
                    children
                )}
            </div>
        </aside>
    );
}
