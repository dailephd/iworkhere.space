# Module: ContactEmail

**Kind:** Module (server-only contact intake and delivery)

## Representative Files

- `src/app/api/contact/route.ts` — thin `POST` adapter (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).
- `src/module/contact/sendContactEmail.server.ts` — direct Resend adapter.
- `src/module/contact/contract.ts` — limits, request type, shared validation (also used by the client form).
- `src/module/contact/body.ts` — contact-owned bounded JSON reader (64 KiB).
- `src/module/contact/origin.ts` — strict same-origin check.
- `src/module/contact/handler.server.ts` — request pipeline.

Tests sit beside each file; the route test is `src/app/api/contact/route.test.ts`.

## Mechanism (precedent: dailephd/my-website-2026 @ `0c71300`)

`ContactPage → ContactForm → POST /api/contact → validation → sendContactEmail → Resend SDK → configured operator inbox`. The visitor address becomes `Reply-To`. There is no contact database, no authentication and no GitHub issue. Reports (`/api/support/*`) are a separate system and are never used for contact; `src/module/support/resend.server.ts` stays metadata-only.

## Request contract

`POST /api/contact`, `Content-Type: application/json`, body ≤ 65,536 bytes (counted while streaming; a declared `Content-Length` above the cap is rejected before reading). Accepted fields only: `senderEmail`, `title`, `message`, `companyWebsite`. Any other field is rejected.

Validation (after trimming `senderEmail`, `title`, `message`): email required, ≤ 254, `^[^\s@]+@[^\s@]+\.[^\s@]+$`, no control characters; title required, ≤ 200, no control characters; message 10–10,000 characters (UTF-16 length, as in the browser), no control characters other than tab/CR/LF. `companyWebsite` must be a string; non-empty after trimming means a bot.

## Pipeline and responses

| Step | Failure | Response |
| --- | --- | --- |
| Origin: `Origin` present and its host equals the forwarded/`Host` host; `Sec-Fetch-Site` is `same-origin` or absent | missing/foreign | 403 `{ ok:false, error:"forbidden" }` |
| JSON content type, bounded read | wrong type / malformed JSON | 400 `{ ok:false, error:"invalid_request" }` |
| | over 64 KiB | 413 `{ ok:false, error:"too_large" }` |
| Object shape, unknown fields | | 400 `invalid_request` |
| Honeypot filled | — | **200 `{ ok:true }`, nothing sent** |
| Field validation | | 400 `{ ok:false, error:"invalid_field", field }` |
| Delivery configuration missing | | 503 `{ ok:false, error:"unavailable" }` |
| Provider error or exception | | 502 `{ ok:false, error:"delivery_failed" }` |
| Provider accepted | | 200 `{ ok:true }` |

Responses never contain environment-variable names, tokens, provider bodies or visitor values. `{ ok:true }` means the provider accepted the message, not that it reached an inbox.

## Delivery

`sendContactEmail(payload, config?, createClient?)` calls `new Resend(apiKey).emails.send(...)` (`resend@6.16.0`, exact pin).

| Variable | Role |
| --- | --- |
| `RESEND_API_KEY` | required |
| `CONTACT_TO_EMAIL` | required operator inbox; server-only; no default |
| `CONTACT_FROM_EMAIL` | required, address on a Resend-verified domain |
| `CONTACT_FROM_NAME` | optional display name, default `iworkhere.space` |
| `CONTACT_SUBJECT_PREFIX` | optional, default `[iworkhere.space contact]` |
| `ALLOW_REAL_CONTACT_EMAIL_TEST` | reserved opt-in flag for a future, explicitly authorized live test; no code path reads it in v0.4.3 |

Deliberate difference from the reference: `CONTACT_TO_EMAIL` has no baked-in default address, so a missing value fails closed instead of mailing a hard-coded personal inbox.

Message: `From: "<name> <CONTACT_FROM_EMAIL>"`, `To: [CONTACT_TO_EMAIL]`, `Reply-To: visitor`, `Subject: "<prefix> <title>"`. Plain-text and HTML bodies carry visitor email, title, message, ISO timestamp and `Source: iworkhere.space contact form`. Every visitor value is HTML-escaped in the HTML body.

## Diagnostics and privacy

Nothing from the visitor (email, title, message, provider error bodies) is logged, tracked or sent to observability. Failures are reported only as a coarse reason (`not_configured`, `provider_error`) and no console output is produced.

## Abuse boundary

Implemented: honeypot (now actually posted by the form), strict validation, 64 KiB streaming cap, required same-origin `Origin`, fail-closed configuration. **Not implemented and not claimed:** rate limiting. Production activation requires a verified deployment-level rate limit for `POST /api/contact` (see `docs/DEPLOYMENT.md`). The Origin check is not authentication.
