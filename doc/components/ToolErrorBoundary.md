# Component: ToolErrorBoundary

## Purpose and ownership

`src/component/tool/ToolErrorBoundary.tsx` owns runtime-error containment and recovery presentation for registered tools.

## Public contract

The class component receives `children` and `toolId`. It reports caught errors through `captureError` and resets only its local error state when “Try again” is activated.

## Visual and responsive role

The fallback is a solid, bounded danger-semantic state with concise copy and a clearly styled recovery action.

## Accessibility and theme interaction

The fallback uses `role="alert"`, a meaningful heading, semantic button behavior, visible focus, and theme tokens. State is not communicated by color alone.

## Invariants

Do not change capture metadata, reset behavior, tool ownership, or introduce a direct provider call.

## Design requirements

Follow `doc/DESIGN.md` sections 17, 18, 25, and 30.
