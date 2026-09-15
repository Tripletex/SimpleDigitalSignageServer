# ---- Admin UI Build ----
FROM denoland/deno:2 AS adminbuild
WORKDIR /app

# Install npm dependencies
COPY server/package.json server/package-lock.json* ./
COPY server/.npmrc server/deno.json ./
RUN deno run -A npm:npm ci

# Build admin UI (matches deno task build:admin)
COPY server/admin/ ./admin/
COPY server/public/ ./public/
COPY server/index.html server/vite.config.ts server/tsconfig.json ./
RUN deno task build:admin

# ---- Server ----
FROM denoland/deno:2 AS release
LABEL org.opencontainers.image.source="https://github.com/Tripletex/SimpleDigitalSignageServer"
WORKDIR /app/server

# Copy server source and config
COPY server/deno.json server/.npmrc ./
COPY server/src/ ./src/
COPY server/migrations/ ./migrations/

# Cache dependencies
RUN deno cache src/main.ts

# Copy built admin UI
COPY --from=adminbuild /app/dist ./dist/

# Run as non-root user (deno user is provided by the base image)
USER deno

EXPOSE 4000

CMD ["deno", "task", "start"]
