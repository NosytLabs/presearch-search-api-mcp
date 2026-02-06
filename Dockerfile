FROM node:20-slim

WORKDIR /app

# Install chrome dependencies for puppeteer and libatomic1 for esbuild
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libatomic1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Ensure args are secure by default if not overridden
ENV PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox"

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Change ownership of the application directory to the 'node' user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port for HTTP transport if needed
EXPOSE 3000

CMD ["node", "src/index.js"]
