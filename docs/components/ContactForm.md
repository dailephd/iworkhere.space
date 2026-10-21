# Component: ContactForm

**Kind:** Component (client form)

## Representative File

`src/component/contact/ContactForm.tsx` (tests: `ContactForm.test.tsx`; page: `src/app/contact/page.tsx`; browser: `test/e2e/v0.4.3-contact-footer.spec.ts`)

## Purpose

The interactive part of `/contact`. It sends general inquiries to `POST /api/contact` (`docs/modules/ContactEmail.md`). It is independent of `NEXT_PUBLIC_SUPPORT_ENABLED`, renders no report button or dialog, and never calls `/api/support/*`.

## Fields and validation

| Field | Rule |
| --- | --- |
| `senderEmail` | required, valid format, trimmed |
| `title` | required, ≤ 200 characters, trimmed |
| `message` | required, 10–10,000 characters, trimmed |
| `companyWebsite` | hidden honeypot (`display:none`, `aria-hidden`, `tabIndex=-1`, `autoComplete=off`); **always included in the posted JSON** (the reference form omitted it) |

Validation uses `parseContactRequest` from `src/module/contact/contract.ts`, the same function the server applies. No file or screenshot upload, no rich text. Inputs carry no `name` attribute and the form is `method="post" action="/api/contact"` with `onSubmit` prevented, so a no-JavaScript or pre-hydration submit can never place visitor text in a URL.

## States

`idle → sending → success | error`. Actions: **Submit** and **Clear message** (resets all fields and the status).

- sending: duplicate submits are blocked by a synchronous in-flight guard and a disabled Submit/Clear; fields become `readOnly` (focus is kept); a `role="status"` region announces "Sending your message…".
- success: fields cleared; `role="status"` message that the message was submitted for delivery, with no inbox-placement or reply-time promise.
- error: visitor text preserved; `role="alert"` message; retry allowed. Field problems set `aria-invalid`, `aria-describedby` and move focus to the first invalid field.

Server codes map to fixed copy (`forbidden`, `too_large`, `unavailable`, `delivery_failed`, `invalid_field`, network failure). Provider internals are never displayed.

## Boundaries

No telemetry of field values, no storage of drafts (nothing in `localStorage`), no analytics events, no `console` usage. Uses existing tokens and shared control classes (same vocabulary as `SupportDialog`).
