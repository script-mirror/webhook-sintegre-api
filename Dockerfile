ARG NODE_IMAGE_VERSION=22-alpine

FROM node:${NODE_IMAGE_VERSION} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY .npmrc ./.npmrc

FROM base AS prod-deps
RUN --mount=type=secret,id=GITHUB_NPM_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    if [ -n "$GITHUB_NPM_TOKEN" ]; then \
        echo "Using GITHUB_NPM_TOKEN from environment variable"; \
    elif [ -f /run/secrets/GITHUB_NPM_TOKEN ]; then \
        export GITHUB_NPM_TOKEN=$(cat /run/secrets/GITHUB_NPM_TOKEN); \
        echo "Using GITHUB_NPM_TOKEN from Docker secret"; \
    else \
        echo "Warning: GITHUB_NPM_TOKEN not found in environment or secrets"; \
    fi && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS build
RUN --mount=type=secret,id=GITHUB_NPM_TOKEN \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    if [ -n "$GITHUB_NPM_TOKEN" ]; then \
        echo "Using GITHUB_NPM_TOKEN from environment variable"; \
    elif [ -f /run/secrets/GITHUB_NPM_TOKEN ]; then \
        export GITHUB_NPM_TOKEN=$(cat /run/secrets/GITHUB_NPM_TOKEN); \
        echo "Using GITHUB_NPM_TOKEN from Docker secret"; \
    else \
        echo "Warning: GITHUB_NPM_TOKEN not found in environment or secrets"; \
    fi && \
    pnpm install --frozen-lockfile --ignore-scripts

COPY . /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm run build

FROM node:${NODE_IMAGE_VERSION}
RUN apk update && apk upgrade
USER node
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
CMD [ "node", "dist/main.js" ]
