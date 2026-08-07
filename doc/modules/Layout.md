# Module: Root Layout

## Purpose and ownership

`src/app/layout.tsx` owns root metadata composition, global style imports, pre-paint theme initialization, `ThemeProvider`, `AppShell`, service-worker registration, navigation data injection, and existing advertising placeholder slots.

## Public contract and behavior

`RootLayout` accepts route `children`. It remains a Server Component and emits one document shell. The inline theme initializer recognizes the seven explicit non-system IDs; absence of `data-theme` represents `system`.

## Visual and responsive role

The root uses the system sans-serif stack and delegates all visual layout to `AppShell` and semantic CSS. Existing banner slots are rendered through their established placeholder components.

## Accessibility and theme interaction

The document language, hydration suppression, pre-paint theme behavior, and single main landmark contract remain intact.

## Invariants

Do not change routes, metadata semantics, theme IDs, storage key, service-worker behavior, provider ownership, or convert the layout to a Client Component.

## Design requirements

Follow `doc/DESIGN.md` sections 7, 15, 25, 26, 28–30.
