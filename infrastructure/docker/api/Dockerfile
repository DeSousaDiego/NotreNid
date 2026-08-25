# Image de production pour l'API Notre Nid (NestJS).
#
# Construire depuis la RACINE du monorepo — pnpm a besoin de voir l'intégralité du workspace
# pour honorer --frozen-lockfile, même si seul apps/api est réellement exécuté à la fin
# (packages/config est sa seule dépendance de workspace — voir apps/api/package.json) :
#
#   docker build -f infrastructure/docker/api/Dockerfile -t notre-nid-api:latest .
#
# Trois cibles :
#   - runtime (par défaut) : lance l'API (`node dist/main.js`).
#   - migrate  : exécute `prisma migrate deploy` puis s'arrête — voir docs/DEPLOYMENT.md.
#       docker build -f infrastructure/docker/api/Dockerfile --target migrate -t notre-nid-api:migrate .
#       docker run --rm -e DATABASE_URL=... notre-nid-api:migrate
#
# Aucun secret n'est intégré à l'image : toutes les variables listées dans .env.example
# doivent être injectées à l'exécution (voir docs/DEPLOYMENT.md).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- build : installe toutes les dépendances (dev incluses) du monorepo, génère le client
# Prisma et compile uniquement l'API en JavaScript (dist/). ---
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @notre-nid/api exec prisma generate
RUN pnpm --filter @notre-nid/api run build

# --- deploy : réduit l'arborescence de l'API à son strict nécessaire d'exécution
# (dist/ + dépendances de production uniquement, sans lien symbolique pnpm). --legacy est
# requis par pnpm 10+ car @notre-nid/api ne déclare pas inject-workspace-packages=true (sa
# seule dépendance de workspace, @notre-nid/config, est une devDependency exclue par --prod
# de toute façon — vérifié localement avec `pnpm --filter @notre-nid/api deploy --prod
# --legacy <dir>`, sans nécessiter Docker). ---
FROM build AS deploy
RUN pnpm --filter @notre-nid/api deploy --prod --legacy /prod/api
# `pnpm deploy` réinstalle un node_modules isolé from scratch pour /prod/api — la sortie
# générée du client Prisma (node_modules/.prisma/client, produite par le `prisma generate`
# ci-dessus dans le node_modules DE /repo) n'y est donc pas copiée. Régénérée ici avec le
# répertoire de travail positionné sur /prod/api pour que Prisma écrive dans CE node_modules
# précis (vérifié localement, hors Docker, via `pnpm --filter @notre-nid/api deploy --prod
# --legacy <dir>` puis `node dist/main.js` : sans ce `cd`, le serveur échoue au démarrage
# avec "Cannot find module '.prisma/client/default'").
RUN cd /prod/api && /repo/node_modules/.bin/prisma generate

# --- runtime : image finale légère, utilisateur non root, healthcheck réel. ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S notrenid && adduser -S notrenid -G notrenid
WORKDIR /app
COPY --from=deploy --chown=notrenid:notrenid /prod/api ./
# Stockage local (STORAGE_DRIVER=local) : répertoire d'écriture pour l'utilisateur non root.
# Sans effet si STORAGE_DRIVER=s3 (recommandé en production, voir docs/DEPLOYMENT.md) —
# un filesystem de conteneur est éphémère et ne doit jamais être la source de vérité des
# images en production.
RUN mkdir -p storage/uploads && chown -R notrenid:notrenid storage
USER notrenid
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# --- migrate : image dédiée à `prisma migrate deploy`, jamais lancée automatiquement au
# démarrage du serveur (évite une course entre plusieurs instances de l'API qui
# migreraient simultanément) — voir docs/DEPLOYMENT.md et docs/OPERATIONS.md. ---
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /repo/apps/api
ENTRYPOINT ["pnpm", "exec", "prisma", "migrate", "deploy"]
