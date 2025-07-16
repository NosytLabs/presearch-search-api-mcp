FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . ./

# Build the application
RUN npm run build

# Expose the port (default 3001 for HTTP server, 8000 for MCP)
EXPOSE 3001 8000

# Default to HTTP server for Smithery, can be overridden
CMD ["node", "dist/http-server-entry.js"]