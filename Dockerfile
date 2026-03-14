# ---- Admin UI Build ----
FROM node:lts AS adminbuild
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
COPY server/.npmrc ./
RUN npm ci
COPY server/admin/ ./admin/
COPY server/public/ ./public/
COPY server/index.html server/vite.config.ts server/tsconfig.json ./
RUN npx vite build

# ---- Server ----
FROM denoland/deno:latest AS release
LABEL org.opencontainers.image.source="https://github.com/Tripletex/SimpleDigitalSignageServer"
WORKDIR /app/server

# Copy server source
COPY server/deno.json server/.env.example ./
COPY server/src/ ./src/
COPY server/migrations/ ./migrations/

# Cache dependencies
RUN deno cache src/main.ts

# Copy built admin UI
COPY --from=adminbuild /app/dist ./dist/

EXPOSE 4000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-run", "src/main.ts"]
