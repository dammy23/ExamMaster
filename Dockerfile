
# ----- Stage 1: Build Frontend -----
    FROM node:18-alpine AS frontend-builder
    WORKDIR /app/client
    COPY client/package*.json ./
    RUN npm ci
    COPY client/ .
    RUN npm run build
    
    # ----- Stage 2: Build Backend -----
    FROM node:18-alpine AS backend
    WORKDIR /app
    
    # Copy backend package files and install
    COPY server/package*.json ./server/
    WORKDIR /app/server
    RUN npm ci
    
    # Copy backend code
    COPY server/ ./ 
    
    # Copy built frontend into server's public folder
    WORKDIR /app
    COPY --from=frontend-builder /app/client/dist ./server/public
    
    WORKDIR /app/server
    
    # Environment variables (passed at runtime)
    ENV PORT=3000
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]
    