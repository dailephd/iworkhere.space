# doc/doc_index.md

# Documentation Index

## 1. Overview

This documentation system defines the architecture, development standards, and
operational procedures for the Modular Utility Platform. Documentation is
organized by function: architectural contracts, development workflows, testing
standards, and operational guides.

The governance philosophy is explicit and contract-driven. Every module boundary
is defined by a TypeScript interface or a schema document. Changes to code must
be preceded by changes to documentation.

---

## 2. Architecture & Design Documents

### architecture.md
**Summary:** Defines the high-level four-layer structure (`app`, `module`,
`component`, `lib`) and the strict dependency rules between them. It details the
tool registry system, the server/client split, and the data flow for tool
rendering.
**When to read:** First read for any new contributor. Essential before creating
new modules or changing layer boundaries.
**Relations:** Enforces the boundaries tested in `TESTING.md`.

### design.md
**Summary:** Outlines the core engineering values: clarity over cleverness,
explicit over implicit, and boring over exciting. It establishes the philosophy
for UI, performance, security, and abstraction.
**When to read:** Before making architectural decisions or introducing new
patterns.
**Relations:** Sets the philosophical groundwork for `styling.md` and
`code-generation-guidelines.md`.

### SCHEMA.md
**Summary:** The central source of truth for data contracts. It defines the
exact shape of `ToolDefinition`, analytics events, log records, storage keys,
and API responses.
**When to read:** Whenever you need to consume data across a module boundary or
add a new field to a shared object.
**Relations:** Directly referenced by `API.md` and enforced by `TESTING.md`.

### API.md
**Summary:** Lists the stable public interfaces of the platform. It distinguishes
between what is safe to import (stable contracts) and what is internal
implementation detail.
**When to read:** When building a new feature that needs to interact with core
platform services like the registry, observability, or storage.
**Relations:** Implements the contracts defined in `SCHEMA.md`.

### project-tree.txt
**Summary:** A text representation of the file structure.
**When to read:** To understand where files are located.
**Relations:** Visualizes the structure defined in `architecture.md`.

### project-status.md
**Summary:** Tracks the current implementation state, completed features, open
decisions, and next steps.
**When to read:** To check what is already built and what is planned next.
**Relations:** Updated as features from `architecture.md` are implemented.

---

## 3. Development & Code Governance

### code-generation-guidelines.md
**Summary:** Strict rules for AI agents and developers generating code. It
forbids speculative implementation, enforces singular naming, and mandates
reading files before writing.
**When to read:** Mandatory for coding agents. Useful for humans to understand
the expected code quality.
**Relations:** Enforces the philosophy in `design.md`.

### CI_CD.md
**Summary:** Defines the mandatory CI checks (typecheck, lint, test, build) that
run on every PR. It explains the test report discipline and the prohibition on
suppressing errors.
**When to read:** When setting up a PR or debugging a CI failure.
**Relations:** Enforces the standards defined in `TESTING.md`.

---

## 4. Testing & CI

### TESTING.md
**Summary:** The comprehensive testing strategy. It defines the four test
categories (Unit, Contract, Integration, E2E), the requirement for unique test
reports, and the rules for SSR safety and hydration mismatch detection.
**When to read:** Before writing any code. Every new feature must have
accompanying tests as defined here.
**Relations:** The practical enforcement of `SCHEMA.md` and `architecture.md`.

---

## 5. Styling & Theming

### styling.md
**Summary:** Defines the visual design system, including color tokens, type
scale, spacing, and component rules. It mandates a utility-first approach using
Tailwind CSS.
**When to read:** Before creating or modifying any UI component.
**Relations:** Implements the "calm and predictable" UI philosophy from
`design.md`.

---

## 6. Operational / Debugging Documents

### debugging.md
**Summary:** A systematic protocol for isolating root causes. It mandates
reading code before reasoning, classifying failures, and applying the smallest
possible fix.
**When to read:** Immediately when a bug is found or a build fails.
**Relations:** Provides the methodology for resolving issues found by `CI_CD.md`
and `TESTING.md`.

---

## 7. Reading Paths

### For new contributors
1. `architecture.md` - Understand the system structure.
2. `design.md` - Understand the engineering values.
3. `project-status.md` - See what is currently built.
4. `TESTING.md` - Learn how to verify your work.

### For implementing a new feature
1. `SCHEMA.md` - Check if data contracts need updates.
2. `API.md` - Identify available stable interfaces.
3. `styling.md` - Review UI standards if building components.
4. `TESTING.md` - Determine required tests.

### For debugging a production issue
1. `debugging.md` - Follow the strict isolation protocol.
2. `architecture.md` - Trace the data flow.
3. `API.md` - Verify interface contracts.

### For modifying CI or governance rules
1. `CI_CD.md` - Understand current gates.
2. `TESTING.md` - Ensure new rules don't break test integrity.
3. `code-generation-guidelines.md` - Update if generation rules change.

---

## 8. Gaps & Observations

- **Overlap:** `API.md` and `SCHEMA.md` both define contracts, but `SCHEMA.md`
  focuses on data shapes while `API.md` focuses on function signatures and
  module boundaries. This separation is clean but requires checking both.
- **Overlap:** `TESTING.md` and `CI_CD.md` both discuss test reporting, but
  `CI_CD.md` focuses on the pipeline mechanics while `TESTING.md` focuses on
  test content.
- **Completeness:** The documentation covers architecture, design, testing, and
  operations well.
- **Naming:** Consistent use of singular naming is enforced in
  `code-generation-guidelines.md` and visible in the file structure.
