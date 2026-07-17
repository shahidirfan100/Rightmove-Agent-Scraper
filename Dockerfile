# Use official Apify SDK base image for JavaScript actors
FROM apify/actor-node:22

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --include=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && node -e "import('impit').then(m => console.log('impit OK:', Object.keys(m)))" \
    && rm -r ~/.npm

# Copy source code
COPY . ./

# Run the actor
CMD npm start --silent