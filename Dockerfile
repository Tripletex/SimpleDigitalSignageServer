# ---- Client Build ----
FROM node:lts AS clientbuild
WORKDIR /usr/src/app
COPY client/ ./client
COPY shared/ ./shared

WORKDIR /usr/src/app/client
RUN npm ci
RUN npm run build

# ---- Server ----
FROM denoland/deno:latest AS release
LABEL org.opencontainers.image.source="https://github.com/Tripletex/SimpleDigitalSignageServer"
WORKDIR /app

# Copy server source
COPY server/ ./server/

# Cache dependencies by running a check
WORKDIR /app/server
RUN deno cache src/main.ts

# Copy built client
COPY --from=clientbuild /usr/src/app/client/build /app/client/

ENV CLIENT_PATH=../client/
EXPOSE 4000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--allow-run", "src/main.ts"]
