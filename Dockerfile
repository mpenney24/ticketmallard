FROM node:22-alpine

WORKDIR /app
ENV CI=true

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm config set strict-dep-builds false

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install

COPY . .

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]