ARG NODE_BASE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM ${NODE_BASE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM ${NODE_BASE_IMAGE} AS builder
WORKDIR /app
ARG NEXT_PUBLIC_ADSENSE_ENABLED=false
ARG NEXT_PUBLIC_OBSERVABILITY_ENABLED=false
ARG NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=false
ENV NEXT_PUBLIC_ADSENSE_ENABLED=$NEXT_PUBLIC_ADSENSE_ENABLED \
    NEXT_PUBLIC_OBSERVABILITY_ENABLED=$NEXT_PUBLIC_OBSERVABILITY_ENABLED \
    NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=$NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    OBSERVABILITY_PERSISTENCE_ENABLED=false \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=20s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`).then(async response => { if (!response.ok || (await response.json()).status !== 'ok') process.exit(1); }).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
