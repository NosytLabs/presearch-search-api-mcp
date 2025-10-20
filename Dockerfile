# Use Node.js 20 Alpine - Smithery compatible Linux distro
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV TRANSPORT=http
ENV NODE_ENV=production

# Expose port
EXPOSE 8081

# Start the MCP server
CMD ["node", "dist/server/server.js"]