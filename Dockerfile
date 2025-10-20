FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Set environment variables for Smithery deployment
ENV TRANSPORT=http
ENV NODE_ENV=production

# Smithery will set PORT=8081, don't hardcode it
# EXPOSE will be dynamic based on PORT env var
EXPOSE 8081

# Start the MCP server in HTTP mode
CMD ["node", "src/server/server.js"]