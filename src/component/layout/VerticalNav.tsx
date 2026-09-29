"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./type";

interface VerticalNavProp {
    item: NavItem[];
    ariaLabel: string;
}

function isActive(href: string, pathname: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
}

export function VerticalNav({ item, ariaLabel }: VerticalNavProp) {
    const pathname = usePathname();

    return (
        <nav aria-label={ariaLabel} className="w-full lg:w-64">
            <ul className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
                {item.map((navItem) => {
                    const active = navItem.href
                        ? isActive(navItem.href, pathname)
                        : false;

                    const className = `
                        flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]
                        ${
                            active
                                ? "bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-text)]"
                                : "bg-[var(--nav-item-bg)] text-[var(--nav-item-muted-text)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--nav-item-text)]"
                        }
                        ${navItem.disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : "cursor-pointer"}
                    `;

                    const content = (
                        <>
                            {navItem.icon && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                    {navItem.icon}
                                </span>
                            )}
                            <div className="flex flex-col leading-tight">
                                <span className="font-medium">
                                    {navItem.label}
                                </span>
                                {navItem.hint && (
                                    <span className="text-xs opacity-80">
                                        {navItem.hint}
                                    </span>
                                )}
                            </div>
                        </>
                    );

                    if (navItem.href && !navItem.disabled) {
                        return (
                            <li key={navItem.id} className="flex-1 lg:flex-none">
                                <Link
                                    href={navItem.href}
                                    aria-current={active ? "page" : undefined}
                                    className={className}
                                >
                                    {content}
                                </Link>
                            </li>
                        );
                    }

                    return (
                        <li key={navItem.id} className="flex-1 lg:flex-none">
                            <span
                                aria-disabled={navItem.disabled}
                                className={className}
                            >
                                {content}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
