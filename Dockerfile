# ----- Stage 1: Build Frontend -----
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./

# Only needed if frontend uses chartjs-node-canvas/canvas
# RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

RUN npm ci --no-audit --no-fund
COPY client/ .
RUN npm run build

# ----- Stage 2: Build Backend -----
FROM node:18-alpine AS backend
WORKDIR /app

# ✅ Install native deps for node-canvas in backend stage
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Copy backend package files and install
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --no-audit --no-fund

# Copy backend code
COPY server/ ./

# Copy built frontend into server's public folder
WORKDIR /app
COPY --from=frontend-builder /app/client/dist ./server/public

WORKDIR /app/server
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
