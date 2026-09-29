# LLM CODE GENERATION GUIDELINES

You are generating code for a production project.
Do NOT generate demo-quality code.

---
## Non-Negotiable Architecture Rules

- Preserve file boundaries
- Preserve layer responsibilities
- Use explicit wiring only
- Do not refactor unless explicitly requested
- Do not introduce speculative abstractions
- Do not create any new name in plural form
- Use singular naming everywhere

---

## **Mandatory Repository Retrieval Rule (No Guessing)**

This project forbids speculative implementation.

Before generating or modifying code that depends on existing repository files,
you MUST:

1. Use my-dev-kit against the current repository state to locate the existing
   behavior owner, extension point, relevant contracts, and closest tests.
2. Retrieve bounded evidence first with search, lookup, slice when relationships
   matter, and exact source retrieval.
3. Use source continuation or local dependency expansion before escalating to a
   complete source/test file read.
4. If bounded retrieval cannot establish the required owner or contract, report
   the exact missing evidence and stop instead of guessing.

This is not optional.

### Forbidden behavior

- Do NOT guess imports or export names.
- Do NOT infer ownership or type shapes from file paths alone.
- Do NOT broadly read source trees for orientation.
- Do NOT ask the user to paste repository files already available to the coding
  environment.
- Do NOT write placeholder code or “most likely” implementations.
- Do NOT create a parallel implementation when an established owner can be
  extended.

### Full-file fallback

A complete source or test file may be read only after bounded my-dev-kit
retrieval cannot supply specific required context. Record the retrieval
attempts, the missing context, and why the full-file fallback was necessary.

---

## General rules

- Always use TypeScript
- Prefer named interfaces over inline types
- Do not invent new abstractions unless asked
- Do not move files across layers
- Do not introduce new patterns silently
- Do not create any new name in plural form. Use singular form.
---

## Pages

- Pages select data and compose components
- Pages do not contain logic
- Pages are Server Components by default

---

## Components

- Components receive all data via props
- Components do not fetch data unless explicitly required
- Client components must declare `"use client"`

---

## Tool components

- Must live in `src/module/tool/**`
- Must accept `ToolComponentProps`
- Must be self-contained
- Must not depend on routing

---

## Error handling

- Fail early
- Use `notFound()` for missing routes
- Avoid silent fallbacks

---

## When NOT to generate code

- When architecture is unclear
- When requirements conflict
- When adding abstraction would cause ambiguity

In those cases, ask for clarification.

This project prefers fewer files, fewer patterns, and fewer surprises.
