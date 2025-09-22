# =======================
# Stage 1: Build Frontend
# =======================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Copy both package.json AND package-lock.json for reproducible builds
COPY client/package.json client/package-lock.json ./

# If the frontend actually needs canvas/chartjs-node-canvas (most do not), 
# install native build deps here. 
# Remove this line entirely if your frontend doesn't use server-side canvas.
# RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Install dependencies using lockfile
RUN npm ci --no-audit --no-fund

# Copy rest of frontend code and build
COPY client/ .
RUN npm run build


# ======================
# Stage 2: Build Backend
# ======================
FROM node:18-alpine AS backend

WORKDIR /app

# ✅ Install native build deps for node-canvas (required by chartjs-node-canvas)
RUN apk add --no-cache \
    python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev

# Copy backend package files AND lockfile
# COPY server/package.json server/package-lock.json ./server/

WORKDIR /app/server

# Install backend dependencies using lockfile
RUN npm ci --no-audit --no-fund

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
