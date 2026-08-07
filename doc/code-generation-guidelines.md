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

## **Mandatory Interaction Rule (No Guessing)**

This project forbids speculative implementation.

Before generating ANY code that depends on existing files, you MUST:

1. List **exactly which existing files** you need to see.
2. For **each file**, state **why** it is required.
3. **STOP** and wait for the user to provide the files.

This is not optional.

### Forbidden behavior

- Do NOT guess imports
- Do NOT assume export names
- Do NOT infer shapes from file paths
- Do NOT write placeholder code
- Do NOT write “most likely” implementations
- Do NOT generate partial implementations

If a required file is missing:
- Ask for it explicitly
- STOP

### Only after files are provided

Once the user provides the requested files:
- Re-read them carefully
- Generate the **final, correct implementation**
- Do not restate assumptions
- Do not re-ask for already provided files

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
