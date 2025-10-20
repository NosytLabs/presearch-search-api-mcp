FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Set environment variables for Smithery deployment
ENV TRANSPORT=http
ENV NODE_ENV=production

# Expose port (Smithery will override with PORT env var)
EXPOSE 8081

# Start the MCP server in HTTP mode
CMD ["node", "src/server/server.js"]