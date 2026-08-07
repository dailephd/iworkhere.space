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
        <nav aria-label={ariaLabel} className="w-full">
            <ul className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-2">
                {item.map((navItem) => {
                    const active = navItem.href
                        ? isActive(navItem.href, pathname)
                        : false;

                    const className = `
                        flex min-h-11 w-full items-center gap-2 rounded-[10px] border border-transparent px-2 py-2 text-left transition-[color,background-color,border-color] duration-180
                        ${
                            active
                                ? "border-[var(--brand-primary)] bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-text)]"
                                : "bg-[var(--nav-item-bg)] text-[var(--nav-item-muted-text)] hover:border-border hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--nav-item-text)]"
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
                            <div className="flex min-w-0 flex-col leading-tight">
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
