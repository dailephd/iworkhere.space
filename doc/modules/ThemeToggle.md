# Module: ThemeToggle

## Purpose and ownership

`src/component/common/ThemeToggle.tsx` owns the existing user-facing theme picker. `ThemeRegistry`, `ThemeStorage`, and `ThemeRuntime` remain the data, persistence, and DOM owners.

## Public contract and behavior

`ThemeToggle()` accepts no props. It lists `listThemes()`, loads the persisted theme after mount, applies and stores selection, and closes when an outside pointer event occurs.

## Visual and responsive role

The trigger is a compact secondary control labeled exactly `Themes`, with no visible palette icon, a minimum 40px height, 12–16px horizontal padding, and a 10px radius. It has no unnecessary fixed width or pill shape. The menu is a solid elevated list with clear selected, hover, and focus states and no alternate mobile structure.

## Accessibility and theme interaction

The trigger exposes expanded and popup state. The listbox and options retain selected state, support keyboard activation through semantic buttons, and use cyan focus treatment. Markup does not vary by theme.

## Invariants

All eight IDs, menu labels, storage key, runtime behavior, system fallback, and provider boundaries remain unchanged. Only the trigger presentation changes.

## Design requirements

Follow `doc/DESIGN.md` sections 9, 16, 17, 25, and 28.
