FROM node:22-alpine

WORKDIR /app
ENV CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm config set strict-dep-builds false

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm config set fetch-timeout 120000 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retries 5 && \
    pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]