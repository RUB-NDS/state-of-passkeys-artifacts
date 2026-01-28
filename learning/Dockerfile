FROM node:20-alpine

LABEL org.opencontainers.image.title="Fun with Flags and Passkeys"
LABEL org.opencontainers.image.description="WebAuthn/Passkey learning platform"
LABEL org.opencontainers.image.source="https://github.com/lonetis/fun-with-flags"

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY dist/ ./dist/
COPY views/ ./views/
COPY public/ ./public/
COPY data/defaults.json ./data/

RUN mkdir -p ./data/instances

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
