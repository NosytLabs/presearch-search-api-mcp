# Multi-stage build for production-ready Brave Search MCP server
# Stage 1: Dependencies
FROM node:18-alpine AS deps
# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies using npm ci for production (faster, more reliable)
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Runtime
FROM node:18-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Set working directory
WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps --chown=mcpuser:nodejs /app/node_modules ./node_modules

# Copy package files
COPY --chown=mcpuser:nodejs package*.json ./

# Copy source code
COPY --chown=mcpuser:nodejs src/ ./src/
COPY --chown=mcpuser:nodejs config/ ./config/

# Copy environment template (actual .env should be mounted at runtime)
COPY --chown=mcpuser:nodejs .env.example ./.env.example

# Copy health check script
COPY --chown=mcpuser:nodejs healthcheck.js ./healthcheck.js

# Make health check script executable
RUN chmod +x healthcheck.js

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R mcpuser:nodejs logs

# Set environment variables
ENV NODE_ENV=production
ENV LOG_DIRECTORY=/app/logs

# Switch to non-root user
USER mcpuser

# Health check for MCP server (tests MCP protocol via stdio)
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=3 \
    CMD node healthcheck.js || exit 1

# Set entrypoint with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the MCP server
CMD ["node", "src/server/server.js"]