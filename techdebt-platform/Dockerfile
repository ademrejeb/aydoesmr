# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined by Next at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8092
ARG NEXT_PUBLIC_BASACORE_ISSUER=
ARG NEXT_PUBLIC_BASACORE_CLIENT_ID=
ARG NEXT_PUBLIC_BASACORE_TENANT_HINT=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_BASACORE_ISSUER=$NEXT_PUBLIC_BASACORE_ISSUER \
    NEXT_PUBLIC_BASACORE_CLIENT_ID=$NEXT_PUBLIC_BASACORE_CLIENT_ID \
    NEXT_PUBLIC_BASACORE_TENANT_HINT=$NEXT_PUBLIC_BASACORE_TENANT_HINT
RUN npm run build

# ---------- run ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]