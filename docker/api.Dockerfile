# =============================================================================
# RoofersLabs API — production image (NestJS + Prisma)
# Build from the repository root:
#   docker build -f docker/api.Dockerfile -t rooferslabs-api .
# =============================================================================

# ---- Stage 1: install all dependencies (with dev, for building) -------------
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace @rooferslabs/shared \
 && npx --prefix apps/api prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace @rooferslabs/api

# ---- Stage 2: production dependencies only ----------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts

# ---- Stage 3: runtime --------------------------------------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

# Production node_modules (workspace symlinks resolve against /app/packages).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Built shared package (target of the @rooferslabs/shared workspace symlink).
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Generated Prisma client + engines.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Application build, schema, and migrations.
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 4000
ENTRYPOINT ["api-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
