# Setup Guide

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- Docker Desktop

## Windows Prerequisite Checks

If PowerShell says `pnpm` is not recognized, install or enable pnpm:

```powershell
node -v
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm -v
```

If `node` is not recognized, install Node.js LTS first from `https://nodejs.org`.

If PowerShell says `docker` is not recognized, install Docker Desktop from `https://www.docker.com/products/docker-desktop/`, start Docker Desktop once, and then open a new PowerShell window.

Check Docker with:

```powershell
docker --version
docker compose version
```

## Install Dependencies

```bash
pnpm install
```

## Configure Environment

```bash
cp .env.example .env
```

Update `.env` values if your local ports or credentials are different.

## Start Services

```bash
docker compose up -d
```

## Prepare Database

```bash
pnpm db:generate
pnpm db:migrate
```

## Run Apps

```bash
pnpm dev
```

Use these commands if you want to run one app at a time:

```bash
pnpm dev:web
pnpm dev:api
```
