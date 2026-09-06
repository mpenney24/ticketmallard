FROM node:22-alpine

WORKDIR /app
ENV CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm config set strict-dep-builds false

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm fetch

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --offline --frozen-lockfile

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]