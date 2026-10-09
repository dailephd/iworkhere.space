# Google AdSense integration

## Public configuration

`src/module/ad/config.ts` is the single configuration owner:

| Identity | Value |
| --- | --- |
| Publisher/client | `ca-pub-7976885058339852` |
| Top/header slot | `4100977160` |
| Right-rail slot | `2496999884` |

Root metadata always includes `google-adsense-account` with the client. `public/ads.txt` always serves plain text at `/ads.txt`, with the exact line:

```text
google.com, pub-7976885058339852, DIRECT, f08c47fec0942fa0
```

Verification does not require live ads. These identifiers are public configuration.

## Page eligibility

Advertising is default-deny at the page level. Manual slots and the AdSense script are composed by `AdSenseEligiblePage`, which is used only by `ToolPageTemplate` after `/tool/[slug]` resolves a registered tool. A valid tool page includes its registered title and description, working tool UI, and related guide content where available. Unknown tool slugs call `notFound()` before the ad frame is rendered.

Registration alone does not keep a failed tool eligible. The existing `ToolErrorBoundary` now wraps the entire eligible frame and tool content; `ToolClientFrame` has no nested boundary that can swallow a rendering failure. A caught tool-render failure replaces that complete subtree with the existing ad-free “Something went wrong” fallback, removing both units, labels and reserved advertising space. Its existing tool-attributed diagnostic, safe metric and “Try again” behavior are retained. Failed retries remain ad-free; a successful retry mounts fresh eligible content and slots. The boundary is keyed by tool ID so navigation to another registered tool does not inherit a previous tool's failure state. Removing slots cannot reverse a completed request or impression or unload an executed script.

This exclusion follows [Google's policy for screens without publisher content](https://support.google.com/publisherpolicies/answer/11112688?hl=en) and its [ad placement guidance](https://support.google.com/adsense/answer/1346295?hl=en), including avoiding accidental clicks.

The root layout does not infer eligibility from a successful response or pathname and does not render ads. Home, Discover, category navigation, not-found, unknown routes, API/operational routes, and pages without the tool template have no manual slots or script. Privacy and other informational pages are excluded by default; `/privacy` is not on this F-02 base branch. After F-01 is merged, retain an integration assertion that `/privacy` renders no `ins.adsbygoogle`, no Advertisement label, and no page-added AdSense script.

The frame is part of the tool page segment, so direct requests render its script and units only for registered tool content. On client navigation, the tool page subtree unmounts when leaving a tool route, removing its slots and labels. Next.js may remove the script element, but the already executed third-party code and its global runtime state can persist; the application does not claim to unload it. The slot runtime initializes each mounted visible element at most once. Returning to an eligible tool route within the same document mounts its configured slots again without fetching the script again. Unknown-route navigation may instead load a new document; its fresh runtime can fetch the script when eligible content is visited again.

The implementation uses manual units only. Auto ads may inject independently of these placements when the site script is present, including after a client navigation away from a tool page. Keep Auto ads disabled in the AdSense account while this page eligibility contract is in use. If account settings change, first configure and verify URL exclusions for every ineligible route and confirm the resulting behavior; application code cannot control the remote Auto ads runtime.

## Activation and placement

Only exact `NEXT_PUBLIC_ADSENSE_ENABLED=true` in a production build activates ads, and then only within the eligible tool-page frame. Absent/other values, development, normal CI, default Playwright and container validation render no ad slot, script, initialization or empty placeholder. Public flags are build-time settings; rebuild after changing them. Tests never click or contact live ads.

One Next Script, page-composed once with `afterInteractive` and `crossOrigin=anonymous`, loads Google's client script on an eligible tool page. Header/right slots reuse one client component and initialize each visible element at most once; width observation defers the hidden right slot. Errors use safe logging and cannot break rendering.

The eligible tool-page frame places a labeled horizontal top ad before tool content and a vertical right unit in a stable 176px column at xl (1280px), hidden narrower. The top reserves at least 100px mobile / 90px from the small desktop breakpoint, with no clipping or maximum height. This reduces insertion CLS but cannot guarantee Google's filled size. Neither slot is a utility control or receives expressive material styling. The root AppShell keeps navigation, header, main content, and footer composition; no footer ad is configured.

## External deployment gate

Do not set the public ad flag true until the operator confirms all of:

1. AdSense site ownership verified.
2. AdSense site status **Ready**.
3. Deployed `/ads.txt` reachable and **Authorized** in AdSense.
4. Applicable Privacy & messaging / Google-certified CMP configured.
5. Auto ads remain disabled, or independently reviewed URL exclusions cover all ineligible routes and are verified against client navigation.

Google requires a Google-certified TCF CMP for personalized ads in the EEA, United Kingdom and Switzerland. Configure the applicable message through AdSense **Privacy & messaging** or another certified CMP; configure applicable US state privacy messages as required. No homegrown consent system is included. See [Google's current consent requirements](https://support.google.com/adsense/answer/13554116?hl=en). Repository code does not prove legal compliance, site Ready, ads.txt authorization, CMP configuration, real serving or revenue.

AdSense reports business ad performance. [Application observability](OBSERVABILITY.md) reports technical effects (CLS/LCP/INP and failures). No application impression/click/revenue telemetry is added.

## Validation and production packaging

Focused unit coverage validates the eligible page frame, stable IDs, disabled output, duplicate-safe initialization, tool failure/retry and boundary reset between tools. Root-layout assertions inspect all four advertising-slot props and include negative fixtures that prove accidental slot composition is detected. `test/e2e/ads-eligibility.spec.ts` checks the default-off build and, with `E2E_ADS_ENABLED=true`, a production build with a stubbed AdSense script and blocked Google ad endpoints. It covers direct invalid routes, eligible and ineligible server output, mobile/desktop placement, navigation in both directions, and repeated navigation. A browser-only Text Encoder fault during the word counter's render exercises the actual tool boundary, ad-free fallback, unsuccessful/successful retry and subsequent navigation without adding a public failure route. `npm run test -- src/component/tool/ToolPageTemplate.test.tsx src/component/tool/ToolErrorBoundary.test.tsx src/app/layout.test.tsx src/module/ad/ad.test.tsx` runs the focused unit contracts; `npm run test:e2e -- test/e2e/ads-eligibility.spec.ts` runs the matching production-build browser scenarios. Container smoke explicitly builds both public enable flags false and verifies exact `/ads.txt` body/content type and `/api/health`, then runs desktop/mobile E2E. No real impression is claimed. Docker production builds accept the two explicit public flag build arguments, defaulting false; activation requires the external gate and a separately authorized deployment.
