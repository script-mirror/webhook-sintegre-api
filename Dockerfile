ARG NODE_IMAGE_VERSION=20

FROM node:${NODE_IMAGE_VERSION} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm
WORKDIR /app
COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml

FROM base AS prod-deps
ARG GITHUB_NPM_TOKEN
ENV GITHUB_NPM_TOKEN=${GITHUB_NPM_TOKEN}
RUN echo "enable-pre-post-scripts=true" > .npmrc && \
    echo "" >> .npmrc && \
    echo "@raizen-energy:registry=https://npm.pkg.github.com/" >> .npmrc && \
    echo "always-auth=true" >> .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_NPM_TOKEN}" >> .npmrc
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
ARG GITHUB_NPM_TOKEN
ENV GITHUB_NPM_TOKEN=${GITHUB_NPM_TOKEN}
RUN echo "enable-pre-post-scripts=true" > .npmrc && \
    echo "" >> .npmrc && \
    echo "@raizen-energy:registry=https://npm.pkg.github.com/" >> .npmrc && \
    echo "always-auth=true" >> .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_NPM_TOKEN}" >> .npmrc
RUN pnpm add -g @nestjs/cli
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
COPY . /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm run build

FROM node:${NODE_IMAGE_VERSION}
USER node
COPY --chown=node:node --from=prod-deps /app/package.json ./package.json
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
CMD [ "node", "dist/main.js" ]