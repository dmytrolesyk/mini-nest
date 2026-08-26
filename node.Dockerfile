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
# reflect-metadata is the only module the compiled tests need at runtime;
# the compiler and its types stay behind in the builder stage.
COPY --from=builder /build/node_modules/reflect-metadata ./node_modules/reflect-metadata
COPY --from=builder /build/dist ./dist
USER node
CMD ["npm", "test"]
