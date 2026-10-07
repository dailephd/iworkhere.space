# Component: WordCharacterCounterTool

## Contract

`src/module/tool/text/WordCharacterCounterTool.tsx` is the client component for
the `word-character-counter` tool (category `text`). It implements
`ToolComponentProp`, owns only UI state, and delegates all counting to
`textMetric.ts`.

### UI

- a multiline input labeled `Text`;
- four metric outputs labeled exactly `Words`, `Characters`,
  `Characters excluding whitespace`, `Lines`, as a `<dl>` so each label is
  programmatically associated with its value;
- a `Reset` button;
- a `role="alert"` area for the two expected errors.

No Calculate/Submit button, no copy button (no transformed result), no charts or
decorative icons.

### Behavior

- Live: metrics are derived from the current input on every change.
- Empty input shows `0` for all four metrics.
- Over 1 MiB UTF-8, or no `Intl.Segmenter` for non-empty input: the input stays
  as typed, a bounded message is announced, and the metric values show an
  explicit unavailable marker (never stale or misleading numbers).
- Reset clears the text and errors, returns every metric to `0`, and refocuses
  the input.

### Telemetry and privacy

Browser-local; no network, storage or query state (`persist: "none"`,
`shareableQuery: false`). There is no explicit execution action, so the tool
emits no `tool_executed` on edits, no custom count events, and nothing derived
from the text (content, length, byte size or counts) reaches `trackEvent`,
`logEvent` or `captureError`. Expected errors are not routed through
`captureError`. Tool opening remains covered by existing page observability.

### Accessibility

Labeled textarea; semantic `<dl>`; announced error region; keyboard-reachable
Reset with the existing visible focus style; no information by color alone; no
horizontal overflow at 390 px width.

### Tests

Initial zeros, live update, labels, ASCII and grapheme counts, apostrophe
integration, Reset, over-limit and unsupported-segmenter states without stale
metrics, no network/storage/query use, no observability calls on edits.
