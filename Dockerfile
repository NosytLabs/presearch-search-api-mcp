# Use Node.js 18 Alpine for smaller image size  
FROM node:18-alpine  
  
# Set working directory  
WORKDIR /app  
  
# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code and configuration
COPY src/ ./src/
COPY config/ ./config/
COPY .env.example ./

# Set the command to run the MCP server
CMD ["node", "src/server/server_enhanced.js"]
