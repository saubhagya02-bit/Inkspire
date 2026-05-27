FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS final

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=base /app/node_modules ./node_modules
COPY . .

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]