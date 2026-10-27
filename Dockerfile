FROM node:22.13.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund

COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN npm run web:build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22.13.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3000
CMD ["node", "apps/api/src/server.js"]
