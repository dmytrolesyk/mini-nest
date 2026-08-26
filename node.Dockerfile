FROM node:24-slim AS builder

WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:test

FROM node:24-slim AS test

WORKDIR /app
COPY package.json ./
COPY --from=builder /build/node_modules/reflect-metadata ./node_modules/reflect-metadata
COPY --from=builder /build/dist-test ./dist-test
USER node
CMD ["npm", "test"]
