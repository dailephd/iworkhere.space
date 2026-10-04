# Module: RustLogProvider

**Kind:** Module

## Production transport contract

Explicit `NEXT_PUBLIC_OBSERVABILITY_ENABLED=true` enables same-origin `/api/log`. The provider catches synchronous/asynchronous failures, uses keepalive, omits credentials/referrer and sends safe pathname only. Bounded redacted developer-authored messages are preserved; metadata passes the allowlist in module/observability/logSafety. File/Blob, filename, input/output, query/hash, full URL and arbitrary nested values are dropped. Canonical serialization preserves useful Error fields, stacks, bounded causes/aggregate children and supplied React component stacks. UUID/fingerprint and explicit browser context accompany warning/error diagnostics. See [OBSERVABILITY](../OBSERVABILITY.md).

<!-- section-id: representative-file -->
## Representative File

`src/module/log/RustLogProvider.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/log/RustLogProvider.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/log/RustLogProvider.ts
- file-role: utility
- default-classification: utility
- Derived from single-file merged unit "RustLogProvider".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
