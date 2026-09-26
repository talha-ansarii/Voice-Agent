# Multi-stage: LiveKit worker + private Express + Next.js dashboard
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN npm ci --prefix frontend

COPY frontend ./frontend
ENV AUTH_SECRET=build-placeholder
ENV AUTH_TRUST_HOST=true
RUN npm run build --prefix frontend

FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y supervisor ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY config.json ./
RUN mkdir -p configs
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY docker-dashboard.sh /app/docker-dashboard.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /app/docker-entrypoint.sh /app/docker-dashboard.sh

# Next standalone (build runs in frontend/; server.js lands at /app/server.js)
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

ENV NODE_ENV=production
ENV LIVEKIT_AGENT_NAME=outbound-caller
ENV PORT=8000
ENV HOSTNAME=0.0.0.0
ENV EXPRESS_INTERNAL_URL=http://127.0.0.1:8000
ENV UI_METRICS_URL=http://127.0.0.1:8000/internal/record-call
ENV AUTH_TRUST_HOST=true

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
