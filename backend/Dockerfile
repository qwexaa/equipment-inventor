# Backend Dockerfile
FROM node:18-bullseye as deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --no-audit --no-fund

FROM node:18-bullseye as build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:18-bullseye as runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY .env.example ./.env.example
EXPOSE 4000
# Create schema at startup (accept data loss for column drops), then run server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
