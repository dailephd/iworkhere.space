# Module: Button

## Purpose and ownership

`src/component/common/Button.tsx` owns the reusable button primitive and its visual variants.

## Public contract

`ButtonProps` extends native button attributes and accepts `variant: "primary" | "secondary" | "ghost" | "danger"`, defaulting to `primary`. Native semantics, events, disabled state, and refs are preserved.

## Visual and responsive role

Buttons use 40–44px comfortable height, 10px radius, semibold labels, and the canonical primary, secondary, ghost, or danger treatments. They do not scale.

## Accessibility and theme interaction

Native keyboard behavior, disabled behavior, and cyan focus treatment are preserved. All colors use semantic variables.

## Invariants

The primitive adds no business logic, navigation, analytics, persistence, or provider access.

## Design requirements

Follow `doc/DESIGN.md` sections 10, 13, 17, 23, 25, and 29.
