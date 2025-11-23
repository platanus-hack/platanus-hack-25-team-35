# Stage 1: Build the React Frontend
FROM node:18-alpine as build-stage
WORKDIR /app/client
COPY client/package.json ./
RUN npm install -g pnpm && pnpm install
COPY client/ .
RUN pnpm run build

# Stage 2: Setup the Node.js Server
FROM node:18-alpine as production-stage
WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies
COPY package.json ./
RUN pnpm install --prod

# Copy server code
COPY server.js .
COPY server ./server

# Copy built frontend assets from build-stage to public directory
COPY --from=build-stage /app/client/dist ./public

# Create uploads directory structure
RUN mkdir -p uploads/audio uploads/exams && chown -R node:node /usr/src/app

# Switch to non-root user for security
USER node

# Expose port
EXPOSE 8080

# Start server
CMD [ "node", "server.js" ]
