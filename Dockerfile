# redtreat Content Studio – Container (Node + Chromium + ffmpeg)
FROM node:20-bookworm

# ffmpeg (Reels) + Basis-Schriften
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
# Chromium + benötigte System-Bibliotheken (passend zur Playwright-Version)
RUN npx playwright install --with-deps chromium

COPY . .
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.js"]
