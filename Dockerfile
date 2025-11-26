FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY .env.example ./

# Create logs directory and ensure permissions
RUN mkdir -p logs && chown -R node:node /app

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Run as non-root user
USER node

# Start the application
CMD ["node", "src/index.js"]