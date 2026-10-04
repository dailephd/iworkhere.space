# Module: Logger

**Kind:** Module

## Production selection

The existing logger remains the provider/level owner. Early explicitly enabled instrumentation selects the sanitized RustLogProvider; the default ConsoleProvider remains local. No SDK or duplicate logging subsystem is introduced. See [OBSERVABILITY](../OBSERVABILITY.md).

<!-- section-id: representative-file -->
## Representative File

`src/module/log/logger.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/log/logger.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/log/logger.ts
- file-role: utility
- default-classification: utility
- Derived from single-file merged unit "Logger".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.


## Diagnostic hotfix

Console and Rust providers preserve redacted bounded messages; arbitrary metadata is projected. Rust warning/error transport includes canonical error fields and browser context. Capture no longer sends raw originalError/arbitrary application objects.
