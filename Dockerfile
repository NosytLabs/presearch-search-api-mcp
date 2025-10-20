# Use Node.js 20 Alpine for better compatibility with undici/File API
FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies for faster builds
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory for Winston logger
RUN mkdir -p logs

# Set environment variables for Smithery deployment
ENV TRANSPORT=http
ENV NODE_ENV=production

# Expose port 8081 (Smithery requirement)
EXPOSE 8081

# Start the MCP server in HTTP mode
CMD ["node", "src/server/server.js"]