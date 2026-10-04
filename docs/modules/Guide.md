# Module: Guide

## Contract

`src/module/tool/guide.ts` owns typed operation-specific explanatory sections, short instructions, and related canonical ToolId lists for the four image tools. `getToolGuide(toolId)` returns optional guide content; non-image tools have none. It defines no slug, category, component, status, or route identity. It is imported only by server composition/tests, never by a client catalog or generic lib helper. Related identities resolve through metadata.ts. Privacy prose distinguishes local processing from ordinary site asset/optional telemetry traffic. Limits remain 25 MiB and 30 MP; no bulk, target-size, metadata-preservation or unsupported-format claims.
