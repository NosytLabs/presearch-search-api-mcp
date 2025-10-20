FROM node:18-alpine

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Faster, deterministic installs
RUN npm ci --omit=dev --no-audit --no-fund

# Copy application code
COPY . .

# Removed curl installation to speed up remote builds
# RUN apk add --no-cache curl

# Default environment variables (replace with secure values in Smithery later)
# PRESEARCH_API_KEY should be provided via environment/secrets at runtime
# ENV PRESEARCH_API_KEY
ENV PORT=8081
ENV LOG_LEVEL=info

# Expose the port
EXPOSE 8081

# Healthcheck to help Smithery detect readiness (Node-based, no curl needed)
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD node -e "require('http').get('http://localhost:8081/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the Streamable HTTP server
CMD ["node", "src/server/server.js"]