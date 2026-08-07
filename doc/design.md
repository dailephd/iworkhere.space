# DESIGN PHILOSOPHY

This project values clarity over cleverness.

Generated code should look like it was written by a careful senior engineer,
not a framework demo.

---

## Core principles

1. Explicit over implicit
2. Boring over clever
3. Readability over brevity
4. Composition over abstraction
5. Separation of concerns at all costs

---

## What "good" code looks like

- Straight-line logic
- Named types instead of inline objects
- No deep nesting
- Minimal indirection
- Clear data flow

Example (good):
const tool = getToolBySlug(slug);
if (!tool) return notFound();

Example (bad):
const tool = toolsMap[slug]?.factory?.create();

---

## What to avoid

- Over-generalization
- Abstract factories
- Meta-programming
- Auto-discovery of files
- Implicit conventions

---

## UI philosophy

- UI should be predictable and calm
- No surprise animations
- No hidden state
- Accessibility by default

---

## Performance mindset

- Assume mobile + slow network
- Avoid large dependencies
- Lazy-load tool code
- Keep JS minimal

---

## Security mindset

- Treat all inputs as untrusted
- Prefer client-side processing
- Avoid server-side file handling unless required
- No eval, no dynamic execution

---

## Analytics abstraction policy

- All analytics go through `track()` from `@/module/analytics`
- Tool components never import analytics SDKs directly
- The analytics provider is swappable without changing tool code
- Only defined event names from `AnalyticEventName` are allowed
- Adding a new event requires updating `type.ts` first

---

## Persistence abstraction policy

- All persistent state access goes through `storage` from `@/lib/storage`
- No direct `localStorage` calls outside the storage adapter
- Storage API is SSR-safe by design
- The storage backend is swappable without changing consumer code
- Used for: theme preference, analytics counter, recently used tool

---

## Documentation discipline

- Architecture changes require updating `doc/architecture.md` first
- Style changes require updating `doc/styling.md` first
- New abstractions require updating `CLAUDE.md`
- Project status is tracked in `doc/project-status.md`

---

If a design choice trades clarity for flexibility, choose clarity.
