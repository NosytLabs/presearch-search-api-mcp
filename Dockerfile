FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . ./

# Build the application
RUN npm run build

# Expose the port (assuming default 8000, adjust if needed)
EXPOSE 8000

CMD ["node", "dist/http-server.js"]