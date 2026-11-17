# Single image: build the Vite frontend, then serve it from the Express API.

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/ ./
COPY --from=web /web/dist ./public

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
CMD ["node", "src/index.js"]
