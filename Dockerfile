# ==========================
# Builder Stage
# ==========================
FROM node:22-slim AS builder
 
WORKDIR /app
 
# Install only build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpango1.0-dev \
&& rm -rf /var/lib/apt/lists/*
 
COPY package*.json ./
 
# Install all dependencies (including dev)
RUN npm ci
 
COPY . .
 
# Generate Prisma client
RUN npx prisma generate
 
# If using TypeScript, uncomment:
# RUN npm run build
 
# Remove dev dependencies
RUN npm prune --omit=dev
 
 
# ==========================
# Runtime Stage
# ==========================
FROM node:22-slim
 
WORKDIR /app
 
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
 
# Install only runtime packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    tesseract-ocr \
    poppler-utils \
    fonts-liberation \
    ca-certificates \
&& rm -rf /var/lib/apt/lists/*
 
# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
 
# Copy application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/. .
 
EXPOSE 5000
 
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]