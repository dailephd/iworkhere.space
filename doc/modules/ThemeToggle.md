# Module: ThemeToggle

## Purpose and ownership

`src/component/common/ThemeToggle.tsx` owns the existing user-facing theme picker. `ThemeRegistry`, `ThemeStorage`, and `ThemeRuntime` remain the data, persistence, and DOM owners.

## Public contract and behavior

`ThemeToggle()` accepts no props. It lists `listThemes()`, loads the persisted theme after mount, applies and stores selection, and closes when an outside pointer event occurs.

## Visual and responsive role

The trigger is a compact 40–44px control with a 10px radius. The menu is a solid elevated list with clear selected, hover, and focus states and no alternate mobile structure.

## Accessibility and theme interaction

The trigger exposes expanded and popup state. The listbox and options retain selected state, support keyboard activation through semantic buttons, and use cyan focus treatment. Markup does not vary by theme.

## Invariants

All eight IDs, labels, storage key, runtime behavior, system fallback, and provider boundaries remain unchanged.

## Design requirements

Follow `doc/DESIGN.md` sections 9, 16, 17, 25, and 28.
