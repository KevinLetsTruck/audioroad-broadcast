# Use Node.js 20 Alpine (small, fast)
FROM node:20-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy ALL application code first (needed for Prisma schema)
COPY . .

# Install dependencies (this will run postinstall with Prisma generate)
RUN npm ci

# Build application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]

