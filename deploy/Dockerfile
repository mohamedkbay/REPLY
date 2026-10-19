FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY server ./server
RUN node server/build.mjs

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 REPLY_DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node migrations ./migrations
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server/start.mjs"]
