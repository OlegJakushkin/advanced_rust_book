FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && touch public/.keep
ARG GITHUB_PAGES=false
ARG PAGES_BASE_PATH=
ENV NEXT_TELEMETRY_DISABLED=1
ENV GITHUB_PAGES=${GITHUB_PAGES}
ENV PAGES_BASE_PATH=${PAGES_BASE_PATH}
RUN pnpm run build

FROM base AS artifact
WORKDIR /app
COPY --from=builder /app/out ./out

CMD ["sh", "-ec", "mkdir -p /export; rm -rf /export/* /export/.[!.]* /export/..?* 2>/dev/null || true; cp -R /app/out/. /export/; echo 'Static site exported to /export'"]

FROM nginx:1.27-alpine AS preview
WORKDIR /app
COPY --from=builder /app/out /opt/out
EXPOSE 80
CMD ["sh", "-ec", "mkdir -p /usr/share/nginx/html /export; rm -rf /usr/share/nginx/html/* /usr/share/nginx/html/.[!.]* /usr/share/nginx/html/..?* 2>/dev/null || true; cp -R /opt/out/. /usr/share/nginx/html/; rm -rf /export/* /export/.[!.]* /export/..?* 2>/dev/null || true; cp -R /opt/out/. /export/; echo 'Static site exported to /export'; nginx -g 'daemon off;'"]
