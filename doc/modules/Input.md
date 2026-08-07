# Module: Input

## Purpose and ownership

`src/component/common/Input.tsx` owns the reusable text-input primitive.

## Public contract

`InputProps` extends native input attributes. Native value, change, form, validation, disabled, and ref behavior are preserved.

## Visual and responsive role

Inputs use a solid elevated surface, semantic border, 10px radius, readable text, restrained placeholder, and comfortable minimum 44px height.

## Accessibility and theme interaction

Consumers must provide a visible or programmatic label. The primitive supplies a cyan focus ring and semantic theme tokens without changing markup by theme.

## Invariants

The primitive adds no validation rules, state ownership, business logic, analytics, or persistence.

## Design requirements

Follow `doc/DESIGN.md` sections 10, 13, 17, 25, and 29.
