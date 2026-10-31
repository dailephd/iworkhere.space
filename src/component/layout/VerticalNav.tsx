"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { NavItem } from "./type";

interface VerticalNavProp {
    item: NavItem[];
    /** Category destinations: a disclosure from 1024 px, always visible inside the open Menu below that. */
    categoryItem?: NavItem[];
    ariaLabel: string;
}

function isActive(href: string, pathname: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
}

const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";
const CONTROL_BUTTON = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-header-muted bg-transparent text-sm font-medium text-header-text hover:bg-nav-hover-bg ${FOCUS_RING}`;

function linkClassName(active: boolean, disabled?: boolean): string {
    return `inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-auto ${FOCUS_RING} ${
        active
            ? "bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-text)]"
            : "bg-[var(--nav-item-bg)] text-[var(--nav-item-muted-text)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--nav-item-text)]"
    } ${disabled ? "cursor-not-allowed opacity-50 pointer-events-none" : "cursor-pointer"}`;
}

export function VerticalNav({ item, categoryItem = [], ariaLabel }: VerticalNavProp) {
    const pathname = usePathname();
    const id = useId();
    const panelId = `${id}-menu`;
    const categoryId = `${id}-category`;
    const navRef = useRef<HTMLElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const categoryButtonRef = useRef<HTMLButtonElement>(null);
    // An open disclosure is remembered with the path it was opened on, so a route change closes it without an effect.
    const [menuPath, setMenuPath] = useState<string | null>(null);
    const [categoryPath, setCategoryPath] = useState<string | null>(null);
    const menuOpen = menuPath === pathname;
    const categoryOpen = categoryPath === pathname;
    const anyOpen = menuOpen || categoryOpen;

    useEffect(() => {
        if (!anyOpen) return;
        const outside = (event: MouseEvent) => {
            if (navRef.current?.contains(event.target as Node)) return;
            setMenuPath(null);
            setCategoryPath(null);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            // The desktop category disclosure and the mobile Menu are never both visible; return focus to the visible trigger.
            const categoryTrigger = categoryButtonRef.current;
            const returnTarget = categoryOpen && categoryTrigger && categoryTrigger.offsetParent !== null ? categoryTrigger : menuButtonRef.current;
            setMenuPath(null);
            setCategoryPath(null);
            returnTarget?.focus();
        };
        document.addEventListener("mousedown", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [anyOpen, categoryOpen]);

    function closeAll() {
        setMenuPath(null);
        setCategoryPath(null);
    }

    function renderLink(navItem: NavItem) {
        const active = navItem.href ? isActive(navItem.href, pathname) : false;
        const className = linkClassName(active, navItem.disabled);
        const content = (
            <>
                {navItem.icon && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {navItem.icon}
                    </span>
                )}
                <span className="flex flex-col leading-tight">
                    <span className="font-medium">{navItem.label}</span>
                    {navItem.hint && <span className="text-xs opacity-80">{navItem.hint}</span>}
                </span>
            </>
        );

        if (navItem.href && !navItem.disabled) {
            return (
                <li key={navItem.id}>
                    <Link href={navItem.href} aria-current={active ? "page" : undefined} className={className} onClick={closeAll}>
                        {content}
                    </Link>
                </li>
            );
        }
        return (
            <li key={navItem.id}>
                <span aria-disabled={navItem.disabled} className={className}>{content}</span>
            </li>
        );
    }

    const categoryActive = (pathname ?? "").startsWith("/category/");

    return (
        <nav ref={navRef} aria-label={ariaLabel} className="lg:min-w-0">
            <button
                ref={menuButtonRef}
                type="button"
                data-menu-button
                className={`${CONTROL_BUTTON} lg:hidden`}
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-controls={panelId}
                onClick={() => {
                    setCategoryPath(null);
                    setMenuPath(menuOpen ? null : pathname);
                }}
            >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
            </button>
            {/* Below 1024 px this panel is a fixed overlay under the header, so opening it never changes the header footprint. */}
            <div
                id={panelId}
                data-nav-panel
                className={`${menuOpen
                    ? "fixed inset-x-0 top-[var(--header-height,4rem)] z-40 max-h-[calc(100dvh-var(--header-height,4rem))] overflow-y-auto overscroll-contain border-b border-header-bg bg-header-bg px-4 py-3 shadow-md sm:px-6"
                    : "hidden"} lg:static lg:block lg:max-h-none lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
            >
                <ul data-primary-nav-list className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-1.5">
                    {item.map(renderLink)}
                    {categoryItem.length > 0 && (
                        <li className="lg:relative">
                            <button
                                ref={categoryButtonRef}
                                type="button"
                                data-category-button
                                data-current-section={categoryActive ? "true" : undefined}
                                className={`hidden min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors lg:inline-flex ${FOCUS_RING} ${
                                    categoryActive
                                        ? "bg-[var(--nav-item-active-bg)] text-[var(--nav-item-active-text)]"
                                        : "bg-[var(--nav-item-bg)] text-[var(--nav-item-muted-text)] hover:bg-[var(--nav-item-hover-bg)] hover:text-[var(--nav-item-text)]"
                                }`}
                                aria-expanded={categoryOpen}
                                aria-controls={categoryId}
                                onClick={() => setCategoryPath(categoryOpen ? null : pathname)}
                            >
                                <span className="font-medium">Categories</span>
                                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>
                            <div
                                id={categoryId}
                                data-category-nav
                                className={`mt-2 border-t border-header-muted pt-2 lg:absolute lg:left-0 lg:top-full lg:z-50 lg:mt-2 lg:w-60 lg:rounded-xl lg:border lg:border-header-muted lg:bg-header-bg lg:p-2 lg:shadow-md ${categoryOpen ? "lg:block" : "lg:hidden"}`}
                            >
                                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-header-muted lg:hidden">Categories</p>
                                <ul data-category-nav-list className="flex flex-col gap-1">
                                    {categoryItem.map(renderLink)}
                                </ul>
                            </div>
                        </li>
                    )}
                </ul>
            </div>
        </nav>
    );
}
