FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile
COPY . .
RUN bun run typecheck && bun run build:client

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=15632 DATABASE_URL=/app/data/db.sqlite MEDIA_DIR=/app/data/media
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/client/dist ./apps/client/dist
COPY --from=build /app/packages/shared ./packages/shared
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
VOLUME ["/app/data"]
EXPOSE 15632
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:15632/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["bun", "run", "--cwd", "apps/server", "start"]
