# ---- Base Node ----
FROM node:lts AS base
WORKDIR /usr/src/app

# ---- client ----
FROM base AS clientbuild
WORKDIR /usr/src/app
COPY client/ ./client
COPY shared/ ./shared

WORKDIR /usr/src/app/client
RUN ls -lrt
RUN npm ci
RUN npm run build

# ---- server ----
FROM base AS serverbuild
WORKDIR /usr/src/app
COPY server/ ./server
COPY shared/ ./shared

WORKDIR /usr/src/app/server
RUN ls -lrt
RUN npm ci
RUN npm run build

# ---- Release ----
FROM base AS release
LABEL org.opencontainers.image.source="https://github.com/Tripletex/SimpleDigitalSignageServer"
COPY --from=clientbuild /usr/src/app/client/build ./client/
COPY --from=serverbuild /usr/src/app/server/ ./server
ENV CLIENT_PATH=../../../../client/
WORKDIR /usr/src/app/server
EXPOSE 4000
CMD [ "node", "build/server/src/server.js" ]