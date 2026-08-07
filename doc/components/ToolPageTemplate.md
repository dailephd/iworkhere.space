# Component: ToolPageTemplate

## Purpose and ownership

`src/component/tool/ToolPageTemplate.tsx` owns tool-page presentation around a registry-owned `ToolDefinition` and supplied tool UI.

## Public contract

Props are `tool: ToolDefinition` and `toolUi: ReactNode`. Registry data is rendered without duplication or mutation.

## Visual and responsive role

The tool identity and existing description precede a solid elevated workspace. The workspace is the dominant content and remains responsive without introducing a per-tool layout system.

## Accessibility and theme interaction

The tool name is the page heading, description is readable secondary text, and workspace boundaries use semantic tokens in all themes.

## Invariants

Do not alter tool lifecycle, registry data, tool UI, URL state, SEO, analytics, validation, or error behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 18, 22, 24, 25, and 30.
