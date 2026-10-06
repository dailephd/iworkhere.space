# SplitPdf

Batch 2 public browser-local tool. `SplitPdfTool.tsx` owns source, group list,
generation, focus and result URLs; `splitPdf.ts` owns deterministic filenames.

Accept one non-empty PDF at most 10 MiB and 100 pages through Batch 1 inspection.
Encrypted/password-protected, malformed and invalid-geometry sources fail
locally. Replacement cancels prior work, discards results/expressions and starts
with one empty group after successful inspection. Groups have opaque stable IDs,
current list order, at least one remaining group and maximum 20 groups.

Each expression uses `parsePageSelection` with actual page count and output cap
100. One-based pages, ascending ranges and comma lists preserve requested order;
first duplicate wins within a group. Separate groups may overlap. Inline labeled
errors explain invalid expressions without rewriting input text. All groups must
parse before the action is enabled.

The existing pdf-lib worker receives operation `split`, request ID, a transferred
copy of source bytes and ordered groups of **one-based** page indices. It checks
non-empty unique indices, source bounds and maximum 20 groups, loads once, then
copyPages/saves each output independently in list order. Each output transfers
as Uint8Array. One short-lived worker uses the inherited timeout/cancel ownership.

Independently reopen every output through PDF.js and compare count/dimensions/
rotation with selected source geometry. Publish all results only after every
verification passes. Fixture acceptance also checks text/order and representative
rendering. Static pages are supported; no metadata/bookmark/form/signature or
accessibility-structure preservation promise exists.

Every result owns an application/pdf Blob and URL. Explicit individual download
anchors use bounded safe filenames containing zero-padded group ordinal and
normalized pages (ascending consecutive runs compressed, sequence preserved),
for example `document-split-01-pages-1-3_5.pdf`. No raw expression in filenames;
Long sequences use fixed two-character base-36 page codes after `seq-`, retaining
every page in order within a filename below 255 characters. No ZIP or automatic
bulk download. Add/remove/edit, new split, source replacement,
Reset and unmount revoke all results, cancel work and invalidate generations.
Stale completion creates no URLs and emits no telemetry; cancellation is silent.

Bounded source errors and processing/timeout/verification failures stay in local
role=alert; group errors are associated with their labeled field. Status uses
role=status. Add focuses the new field, remove focuses the preceding remaining
field, Reset focuses source input, validation failure focuses alert and verified
success focuses result heading. Existing token-based controls wrap on mobile.

PDF bytes/names/sizes/pages/ranges never enter network, storage, URL state or
telemetry. Verified success emits only tool_executed with toolId/slug. Ordinary
application asset traffic and separately enabled observability remain possible.

Adjacent unit/component tests and real fixture browser tests own acceptance.
