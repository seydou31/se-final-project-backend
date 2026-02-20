# Stage 1: Install production dependencies
# python3/make/g++ needed to compile native modules (sharp)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production runtime
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Writable directories for file uploads and Winston logs
RUN mkdir -p uploads logs && chown -R node:node /app

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "app.js"]
