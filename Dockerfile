FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapters/package.json packages/adapters/
COPY packages/preference-store/package.json packages/preference-store/
COPY packages/concierge/package.json packages/concierge/
RUN npm ci --omit=dev

FROM base AS builder
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/ apps/api/
COPY packages/ packages/
RUN npm ci
RUN npx turbo build --filter=@courtiq/api...

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/preference-store/node_modules ./packages/preference-store/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/concierge/node_modules ./packages/concierge/node_modules 2>/dev/null || true
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=builder /app/packages/adapters/package.json ./packages/adapters/
COPY --from=builder /app/packages/preference-store/dist ./packages/preference-store/dist
COPY --from=builder /app/packages/preference-store/package.json ./packages/preference-store/
COPY --from=builder /app/packages/concierge/dist ./packages/concierge/dist
COPY --from=builder /app/packages/concierge/package.json ./packages/concierge/
COPY --from=builder /app/package.json ./

# Migration SQL files (needed for release_command)
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
