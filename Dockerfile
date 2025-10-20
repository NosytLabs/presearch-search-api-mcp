# Use Node.js 20 Alpine for better compatibility with undici/File API
FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for potential build)
RUN npm install

# Copy application code
COPY . .

# Set environment variables for Smithery deployment
ENV TRANSPORT=http
ENV NODE_ENV=production

# Expose port (Smithery will override with PORT env var)
EXPOSE 8081

# Start the MCP server in HTTP mode
CMD ["node", "src/server/server.js"]