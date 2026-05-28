# Stage 1: install dependencies 
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: final image 
FROM node:20-alpine AS final

WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps /app/node_modules ./node_modules

COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3004}/health || exit 1

CMD ["node", "src/index.js"]