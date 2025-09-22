# =======================
# Stage 1: Build Frontend
# =======================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Copy only package.json (no lockfile)
COPY client/package.json ./

# If your frontend uses chartjs-node-canvas (rare), add native deps here.
# Typically React/Vue just use browser Chart.js so you can skip this line.
# RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Install frontend dependencies
RUN npm install --no-audit --no-fund

# Copy and build the frontend
COPY client/ .
RUN npm run build


# ======================
# Stage 2: Build Backend
# ======================
FROM node:18-alpine AS backend

WORKDIR /app

# ✅ Install native build deps for node-canvas (needed by chartjs-node-canvas)
RUN apk add --no-cache \
    python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev

# Copy backend package.json (no lockfile)
COPY server/package.json ./server/

WORKDIR /app/server

# Install backend dependencies
RUN npm install --no-audit --no-fund

# Copy backend source code
COPY server/ ./

# Copy built frontend into server's public folder
WORKDIR /app
COPY --from=frontend-builder /app/client/dist ./server/public

# Back to server working directory
WORKDIR /app/server

# Environment variables
ENV PORT=3000
EXPOSE 3000

# Start the backend
CMD ["node", "server.js"]
