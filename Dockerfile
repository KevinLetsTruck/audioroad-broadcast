# Use Node.js 20 Alpine (small, fast)
FROM node:20-alpine

# Install FFmpeg, OpenSSL 3, and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    openssl \
    openssl-dev \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy ALL application code first (needed for Prisma schema)
COPY . .

# Install dependencies (this will run postinstall with Prisma generate)
RUN npm ci

# Accept build-time environment variables (from Railway)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build application (Vite will use VITE_CLERK_PUBLISHABLE_KEY)
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]

