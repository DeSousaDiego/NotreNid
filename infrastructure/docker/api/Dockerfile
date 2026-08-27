# Image de production pour l'API Notre Nid (NestJS).
#
# Construire depuis la RACINE du monorepo — pnpm a besoin de voir l'intégralité du workspace
# pour honorer --frozen-lockfile, même si seul apps/api est réellement exécuté à la fin
# (packages/config est sa seule dépendance de workspace — voir apps/api/package.json) :
#
#   docker build -f infrastructure/docker/api/Dockerfile -t notre-nid-api:latest .
#
# Deux usages :
#   - runtime (par défaut) : lance l'API (`node dist/main.js`).
#   - migrate : exécute `prisma migrate deploy` puis s'arrête — voir docs/DEPLOYMENT.md.
#
# Pour construire explicitement l'image de migration :
#
#   docker build -f infrastructure/docker/api/Dockerfile --target migrate -t notre-nid-api:migrate .
#   docker run --rm -e DATABASE_URL=... notre-nid-api:migrate
#
# Aucun secret n'est intégré à l'image : toutes les variables listées dans .env.example
# doivent être injectées à l'exécution (voir docs/DEPLOYMENT.md).


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base

RUN corepack enable

WORKDIR /repo


# ---------------------------------------------------------------------------
# Build
#
# Installe toutes les dépendances (dev incluses) du monorepo, génère le client
# Prisma et compile uniquement l'API en JavaScript (dist/).
# ---------------------------------------------------------------------------

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @notre-nid/api exec prisma generate

RUN pnpm --filter @notre-nid/api run build


# ---------------------------------------------------------------------------
# Deploy
#
# Réduit l'arborescence de l'API à son strict nécessaire d'exécution
# (dist/ + dépendances de production uniquement, sans lien symbolique pnpm).
#
# --legacy est requis par pnpm 10+ car @notre-nid/api ne déclare pas
# inject-workspace-packages=true. Sa seule dépendance de workspace,
# @notre-nid/config, est une devDependency exclue par --prod.
# ---------------------------------------------------------------------------

FROM build AS deploy

RUN pnpm --filter @notre-nid/api deploy --prod --legacy /prod/api

# `pnpm deploy` réinstalle un node_modules isolé from scratch pour /prod/api.
# La sortie générée du client Prisma dans /repo/node_modules n'y est donc pas
# automatiquement copiée.
#
# On régénère le client Prisma directement depuis /prod/api afin que
# node_modules/.prisma/client soit présent dans l'image finale.
RUN cd /prod/api && /repo/node_modules/.bin/prisma generate


# ---------------------------------------------------------------------------
# Migrate
#
# Image dédiée à `prisma migrate deploy`.
# Elle n'est jamais utilisée comme image finale par défaut.
#
# À construire explicitement avec :
#   docker build ... --target migrate ...
#
# Cela évite de lancer automatiquement des migrations au démarrage de chaque
# instance de l'API.
# ---------------------------------------------------------------------------

FROM build AS migrate

ENV NODE_ENV=production

WORKDIR /repo/apps/api

ENTRYPOINT ["pnpm", "exec", "prisma", "migrate", "deploy"]


# ---------------------------------------------------------------------------
# Runtime
#
# IMPORTANT :
# Ce stage doit rester le DERNIER du Dockerfile.
#
# Ainsi :
#   docker build -f infrastructure/docker/api/Dockerfile .
#
# construit par défaut l'image de l'API.
#
# C'est également le comportement attendu par Render, qui construit le
# Dockerfile sans avoir besoin de préciser `--target runtime`.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

RUN addgroup -S notrenid \
    && adduser -S notrenid -G notrenid

WORKDIR /app

COPY --from=deploy --chown=notrenid:notrenid /prod/api ./

# Stockage local (STORAGE_DRIVER=local) :
# répertoire d'écriture disponible pour l'utilisateur non root.
#
# Sans effet avec STORAGE_DRIVER=s3, qui est le mode utilisé en production.
RUN mkdir -p storage/uploads \
    && chown -R notrenid:notrenid storage

USER notrenid

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]