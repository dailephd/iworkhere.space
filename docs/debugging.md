# DEBUGGING

This document defines the systematic debugging discipline for this project.

It applies to:
- UI issues
- Tool logic bugs
- API and route failures
- SSR and hydration mismatches
- Storage and persistence issues
- Logging and analytics wiring
- Build and TypeScript failures
- CI workflow failures
- Orchestrator failures
- Performance regressions
- Environment and configuration problems

This protocol is mandatory for both human engineers and coding agents.

The goal of debugging is not rewriting code.
The goal is isolating the earliest boundary where truth changes.

Never refactor before isolating the root cause.

---

## Core Principles

1. Read actual source before reasoning.
2. Diagnose from boundaries, not assumptions.
3. Enumerate independent preconditions.
4. Identify one single root cause.
5. Apply the smallest possible fix.
6. Verify fully before closing.
7. Add safeguards to prevent recurrence.

---

## Phase 0 — Stabilize

Before debugging:

- Create a branch named debug/<topic>.
- Ensure the repository builds if possible.
- If the repo is already broken, commit the current state before making changes.
- Do not combine debugging with feature development.

Purpose: prevent cascading damage.

---

## Phase 1 — Define the Failure

Write a clear failure statement containing:

- Expected behavior.
- Actual behavior.
- Scope: which routes, modules, or environments are affected.
- Exact trigger steps.
- Environment details: local vs CI, browser, Node version, commit hash.

Do not touch code until this is written.

---

## Phase 2 — Reproduce Deterministically

Ensure the issue is reproducible.

Ask:

- Does it fail consistently?
- Only in development?
- Only in production build?
- Only in CI?
- Only after hydration?
- Only after a specific user flow?

If the issue is non-deterministic, suspect:
- Async timing
- Race conditions
- Stale state
- Environmental drift

Document exact reproduction steps.

---

## Phase 3 — Read Before Reasoning (Mandatory)

Before forming hypotheses:

1. List the exact files involved.
2. Open and read them.
3. Summarize what they actually contain:
    - Relevant imports
    - Relevant functions
    - Relevant types
    - Relevant layout structure
    - Relevant wiring

Never guess file contents.
Never assume imports.
Never assume structure.

If a file was not read, it cannot be part of reasoning.

---

## Phase 4 — Classify the Failure

Classify the bug into exactly one primary category:

- Structural (layout, routing, mounting)
- Logical (incorrect computation)
- State (persistence, hydration, stale data)
- Boundary (server/client mismatch, API contract mismatch)
- Async (timing, race, missing await)
- Build-time (TypeScript, lint, import resolution)
- Runtime exception
- Performance regression
- CI pipeline failure
- Environment/configuration

Classification prevents random fixes.

---

## Phase 5 — Trace the End-to-End Chain

Explicitly define the chain involved.

Examples:

UI:
Render → DOM → CSS → Computed layout → Interaction

Tool logic:
Input → Validation → Pure function → Result → Render

API:
Client request → Network → Route handler → Response → Client parse

Persistence:
Write → Storage layer → Read → Hydration → Usage

SSR:
Server render → Serialized props → Client hydration → DOM diff

Build:
Source file → TypeScript → Bundler → Output → Runtime

Trace the full chain from start to finish.
Mark where data first becomes incorrect.

This boundary is the root cause zone.

---

## Phase 6 — Enumerate Preconditions

List all independent conditions that must hold for correct behavior.

Typically 3 to 6 conditions.

Example structure:

Condition A:
Must be true for feature to work.

Condition B:
Must be true.

Condition C:
Must be true.

For each condition:

- Verify independently.
- Mark as PASS or FAIL.
- Provide evidence.

Do not merge conditions.
Do not reason abstractly.
Verify each independently.

---

## Phase 7 — Identify the Single Root Cause

After checking preconditions:

State the root cause in one sentence:

Condition X failed because Y at boundary Z.

There must be exactly one primary failing condition.

If multiple conditions fail, identify the earliest failure in the chain.

---

## Phase 8 — Form Hypotheses (If Needed)

If the root cause is not obvious:

- Limit to 2–4 hypotheses.
- For each:
    - What supports it?
    - What falsifies it?
    - What is the cheapest falsification test?

Run cheapest falsification tests first.

Never rewrite code to test a hypothesis unless necessary.

---

## Phase 9 — Apply the Smallest Fix

Rules:

- Fix at the earliest incorrect boundary.
- Change the minimum lines required.
- Do not refactor.
- Do not reorganize files.
- Do not rename symbols.
- Do not improve adjacent code.
- Do not introduce new abstraction.
- Do not move files across layers.

If architecture must change, stop and document reasoning first.

Debugging is surgical, not architectural redesign.

---

## Phase 10 — Verify Across the System

After the fix:

1. Reproduce the original failure steps.
2. Confirm the issue is resolved.
3. Check adjacent flows.
4. Run:

   npm run typecheck  
   npm run lint  
   npm run test  
   npm run build

5. Confirm no regressions.
6. For test runs, report:
    - RUN_ID
    - test-report/<RUN_ID> path
    - Summary of results

For CI failures:
- Identify failing workflow name.
- Identify failing step.
- Include failing log snippet reference.

---

## Phase 11 — Add a Safeguard

Prevent recurrence by adding one of:

- Unit test
- Integration test
- Type-level constraint
- Runtime invariant
- Validation guard
- Logging at boundary

Prefer automated protection over comments.

---

## Phase 12 — Document the Root Cause

Add a short note to the appropriate document:

- `docs/architecture.md` if it was a boundary or layering issue.
- `docs/DESIGN.md` if it was a design or styling system issue.
- `docs/code-generation-guidelines.md` if it was agent behavior.
- `README.md` if it affects developer workflow.
- `docs/DESIGN.md` if it reflects a design tradeoff.

Document:

- What failed
- Where it failed
- Why it failed
- Why the minimal fix works
- How future failures are prevented

---

## Absolute Prohibitions During Debugging

- No guessing.
- No refactor during root cause isolation.
- No mixing debugging with feature work.
- No dynamic rewiring without tracing the chain.
- No architectural changes without explicit justification.
- No speculative improvement.

---

## Final Principle

Diagnose from actual files.
Trace the real chain.
Isolate the failing condition.
Fix the smallest surface.
Verify completely.
Protect against recurrence.

Debugging is boundary isolation, not code rewriting.
