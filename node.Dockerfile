FROM node:24-slim AS builder

WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:test

FROM node:24-slim AS test

WORKDIR /app
RUN corepack enable
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist-test ./dist-test
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY test ./test
CMD ["npm", "test"]
