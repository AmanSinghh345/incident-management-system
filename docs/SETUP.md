# Setup Guide

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- Docker Desktop

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
