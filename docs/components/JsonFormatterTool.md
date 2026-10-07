# Component: JsonFormatterTool

## Contract

`src/module/tool/developer/JsonFormatterTool.tsx` is the client component for
the `json-formatter` tool (category `developer`). It implements
`ToolComponentProp`, owns only UI state, and delegates all JSON behavior to
`jsonFormat.ts`.

### UI

- labeled JSON input textarea;
- read-only JSON output textarea;
- `Format JSON`, `Minify JSON`, `Copy result`, `Reset` buttons;
- an error region with `role="alert"`.

Uses the existing Tailwind/token styling and the HTML Text Extractor text-tool
precedent; no new shared UI abstraction.

### Interaction

- Editing the input clears the output, any copied state and any previous error
  so output never refers to older input.
- Format / Minify: measure UTF-8 bytes, enforce 1,048,576, validate/scan; on
  success show output; on expected validation failure show the bounded error
  and leave output empty.
- Copy: disabled without current output; copies exactly the displayed output;
  clipboard failure shows a safe message without content.
- Reset clears input, output, error and copied state and returns focus to the
  input.

### Privacy and telemetry

Browser-local. No network request, persistence or query state carries JSON
(`persist: "none"`, `shareableQuery: false`). Only the observability facade is
used: `tool_executed` after a successful Format/Minify and `tool_result_copied`
after a successful copy, each with `{ toolId, slug }` only. No JSON content,
size, error excerpt, key name or output appears in `trackEvent`, `logEvent` or
`captureError`. Validation failures are user outcomes, not diagnostics.

### Tests

Initial state, Format, Minify, `role="alert"` errors, no output after failure,
stale-output clearing, exact copy, clipboard success/failure, Reset, over-limit
error, no network, no storage/query, identity-only observability.
