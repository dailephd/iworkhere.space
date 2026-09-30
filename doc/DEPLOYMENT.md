# Deployment and Docker Preview

Docker is an optional production-style preview. Normal development remains
`npm run dev` and does not start Docker.

## Requirements and commands

Install Docker Desktop on Windows, or Docker Engine with the Compose plugin on
Linux/macOS. On Windows, `npm run docker:ready` silently checks/starts Docker
Desktop and waits for its engine (180 seconds by default; override with the
positive integer `DOCKER_START_TIMEOUT_SECONDS`). The supported local/CI Node
runtime is `24.x`; Docker stages use the digest-pinned
`node:24-bookworm-slim` base.

```sh
npm ci
npm run dev                 # normal development
npm run docker:ready        # optional Docker Desktop readiness check
npm run dev:docker           # build and run the production preview
npm run dev:docker:down      # stop the Compose preview
npm run test:container      # hardened image and browser validation
```

The Docker image uses Next.js standalone output and runs its generated
`server.js` on internal port `3000` as a non-root user. Compose publishes
`3000:3000`; other platforms can map their service port to container port 3000.
`GET /api/health` returns `{"status":"ok"}` and is the image health check.

The runtime image contains the standalone trace, static/public assets and
third-party notices. The application runs without local `.env` files. The
container smoke gate exercises a read-only root filesystem, a temporary `/tmp`,
and the existing desktop/mobile Playwright suite against the running container.
Set `E2E_BASE_URL` only when intentionally running that same suite against an
already-running external runtime; otherwise Playwright owns its normal local
production server.

## Browser runtime assets

The service worker and manifest are served from the application origin. The
HEIC decoder remains lazy: its Worker and decoder assets load from local
application assets after a HEIC source is selected, with no external conversion
service. The runtime retains
`/licenses/heic-to-LICENSE.txt` and
`/licenses/libheif-COPYING.txt`, plus `/THIRD_PARTY_NOTICES.md`.

For internet-facing hosting, run the application behind the platform ingress,
load balancer, or a separately managed reverse proxy. TLS termination and
deployment are outside this application image. No Docker registry publication
or automated deployment is configured. HEIC production-license approval is
still required; `HEIC_RELEASE_READY=NO` and `V0_2_RELEASE_READY=NO` remain in
force.
