# Module: Guide

## Contract

`src/module/tool/guide.ts` owns typed operation-specific explanatory sections, short instructions, and related canonical ToolId lists for four image tools and five document tools. `getToolGuide(toolId)` returns optional guide content; the six original text/math/time/everyday tools have none. It defines no slug, category, component, status, or route identity. It is imported only by server composition/tests, never by a client catalog or generic lib helper. Related identities resolve through metadata.ts. Privacy prose distinguishes local processing from ordinary site asset/optional telemetry traffic. Image-family limits remain 25 MiB and 30 MP; no bulk, target-size, metadata-preservation or unsupported-format claims are introduced for that family.

Document guides describe each operation's supported formats, explicit downloads,
fidelity boundaries and local processing. Single PDF sources are 10 MiB/100
pages; Merge accepts 2–10 with 25 MiB/100 aggregate pages; Split has 20 groups.
Images to PDF accepts 1–20 JPEG/PNG images, 25 MiB together and 30 MP each.
PDF image export has 20 outputs, 72/150/300 DPI (150 default), 4096 per side /
16 MP and JPEG quality 0.50–1.00 (0.85 default). Compress PDF has one lossless
structural mode and explicitly describes normal NO REDUCTION ACHIEVED outcomes.
No ZIP, OCR, signing, repair, password entry or lossy PDF compression is claimed.
Related IDs stay within the respective document/image family and resolve through
metadata; the shared template derives the category-aware related-tools heading.
