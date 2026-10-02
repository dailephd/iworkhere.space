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

## Activation and placement

Only exact `NEXT_PUBLIC_ADSENSE_ENABLED=true` in a production build activates ads. Absent/other values, development, normal CI, Playwright and container validation render no ad slot, script, initialization or empty placeholder. Public flags are build-time settings; rebuild after changing them. Tests never click or contact live ads.

One Next Script, root-composed once with `afterInteractive` and `crossOrigin=anonymous`, loads Google's client script. Header/right slots reuse one client component and initialize each visible element at most once; width observation defers the hidden right slot. Errors use safe logging and cannot break rendering.

AppShell remains the layout owner. Header/nav is followed by a labeled responsive horizontal top ad and then content. The top reserves at least 100px mobile / 90px from the small desktop breakpoint, with no clipping or maximum height. This reduces insertion CLS but cannot guarantee Google's filled size. Right uses a stable 176px column at xl (1280px), hidden narrower; the vertical unit has no fixed height. Neither slot is a utility control or receives expressive material styling. Footer slot capability remains, but root provides no fake footer banner and no footer ad is configured.

## External deployment gate

Do not set the public ad flag true until the operator confirms all of:

1. AdSense site ownership verified.
2. AdSense site status **Ready**.
3. Deployed `/ads.txt` reachable and **Authorized** in AdSense.
4. Applicable Privacy & messaging / Google-certified CMP configured.

Google requires a Google-certified TCF CMP for personalized ads in the EEA, United Kingdom and Switzerland. Configure the applicable message through AdSense **Privacy & messaging** or another certified CMP; configure applicable US state privacy messages as required. No homegrown consent system is included. See [Google's current consent requirements](https://support.google.com/adsense/answer/13554116?hl=en). Repository code does not prove legal compliance, site Ready, ads.txt authorization, CMP configuration, real serving or revenue.

AdSense reports business ad performance. [Application observability](OBSERVABILITY.md) reports technical effects (CLS/LCP/INP and failures). No application impression/click/revenue telemetry is added.

## Validation and production packaging

Tests use stubs for enabled code contracts and block/assert zero Google advertising requests in the default browser suite. Container smoke explicitly builds both public enable flags false and verifies exact `/ads.txt` body/content type and `/api/health`, then runs desktop/mobile E2E. No real impression is claimed. Docker production builds accept the two explicit public flag build arguments, defaulting false; activation requires the external gate and a separately authorized deployment.
