# BizHub

PCC2K's business-development engine. Scans public bid portals, matches government
grants to existing clients, and drafts proposals with real equipment pricing +
labor estimates.

Companion to **DocHub** (client docs & assets) and **TicketHub** (MSP ops).
BizHub reads from both, writes draft estimates back into TicketHub, and creates
project records in DocHub on wins.

## Status

**Framework only.** Auth, schema, Docker, dashboard, empty `/opportunities`
list. No data pollers, no AI, no PDF generation yet. See `PLANNING.md` for the
roadmap.

## Quick start

```bash
cd ~/bizhub
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, AZURE_AD_* (copy from ~/tickethub/.env.local)
docker compose up -d --build
docker compose logs -f app
```

Schema push (run from a one-shot container so `db:5432` resolves on the
`dochub_default` network):

```bash
docker run --rm --network dochub_default \
  -v "$HOME/bizhub:/work" -w /work \
  -e "DATABASE_URL=$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" \
  node:20-alpine sh -c "npx --yes prisma@6 db push --skip-generate"
```

Then regenerate the client on the host:

```bash
npx prisma generate
```

(See `~/.claude/.../feedback_smellymelly_docker_build.md` for context on why
this pattern — the prod container doesn't include the Prisma CLI.)

## Ports

- `3003` on the host → `3000` in the container
- Behind nginx at `bizhub.pcc2k.com` (TLS via certbot)

Sister apps use: `3001` (TicketHub), `3002` (Smelly Melly).

## Architecture

- **Separate Next.js app** at its own subdomain — not a TicketHub module
- **Own `bizdev` schema** on the shared Postgres — prisma `db push` is scoped
  by `schemas = ["bizdev"]` so it can't touch DocHub or TicketHub tables
- **Shared NextAuth + Entra ID** — users SSO across all three apps
- **Cross-schema references by string ID** — e.g. `BD_ClientGrantMatch.externalClientId` stores `TH_Client.id`. No Prisma FK across schemas.

## Repo layout

```
app/
  api/auth/[...nextauth]/    NextAuth with Azure AD provider
  lib/                       prisma singleton, auth options + role helpers
  opportunities/             empty list (first slice)
  layout.tsx, page.tsx, globals.css
components/
  TopBar.tsx                 module switcher back to DocHub/TicketHub
prisma/schema.prisma         BD_* models in the bizdev schema
middleware.ts                Entra auth guard
Dockerfile, docker-compose.yml
```
