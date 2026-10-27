FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN LAUNCHLANE_STANDALONE=true npm run build

FROM docker:29.0.1-cli@sha256:f7d048590d889e00868920f658e807ecbc4ef662d51c9af67eb5534a447d58d6 AS docker-cli
FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
RUN docker --version && node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');db.close()"
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/examples/node-service ./examples/node-service
COPY --chown=node:node src/contracts ./src/contracts
COPY --chown=node:node src/server/config.ts src/server/errors.ts ./src/server/
COPY --chown=node:node src/server/policy/probe-target.ts ./src/server/policy/
COPY --chown=node:node scripts/start-hosted.mjs scripts/model-budget.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-hosted.mjs", "--standalone"]
