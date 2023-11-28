# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=20.8.0
FROM zenika/alpine-chrome:102-with-node-16
# FROM ubuntu:latest

# RUN apt-get update && apt-get install -y ca-certificates curl gnupg
# RUN mkdir -p /etc/apt/keyrings
# RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |  gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
# RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" |  tee /etc/apt/sources.list.d/nodesource.list
# RUN apt-get update && apt-get install nodejs -y


# RUN apt-get update && apt-get install gnupg wget -y && \
#   wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
#   sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
#   apt-get update && \
#   apt-get install google-chrome-stable -y --no-install-recommends && \
#   rm -rf /var/lib/apt/lists/*




# Use production node environment by default.
# ENV NODE_ENV production
# ENV PUPPETEER_CACHE_DIR /usr/src/app/.cache/puppeteer

WORKDIR /usr/src/app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser
# RUN npm install @puppeteer/browsers
RUN npm install

# COPY . .
# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
# RUN --mount=type=bind,source=package.json,target=package.json \
#     --mount=type=bind,source=package-lock.json,target=package-lock.json \
#     --mount=type=cache,target=/root/.npm \
#     npm ci --omit=dev

# RUN npm install puppeteer qrcode express body-parser
# Run the application as a non-root user.
# USER node

# Copy the rest of the source files into the image.
COPY . .

# Expose the port that the application listens on.
EXPOSE 3000


# Run the application.
CMD [ "node", "main.js"]
