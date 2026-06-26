# PulseOps

PulseOps is a real-time incident management and service monitoring system. The MVP will let teams add URL monitors, run periodic health checks, create incidents from repeated failures, notify users, and show live operational status.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- Database: PostgreSQL with Prisma
- Queue and worker: Redis with BullMQ
- Realtime: Socket.IO
- Package manager: pnpm
- Repository style: monorepo

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Frontend runs at `http://localhost:3000`.
Backend runs at `http://localhost:4000`.
Health check endpoint: `http://localhost:4000/health`.

## Folder Structure

```text
apps/
  web/      Next.js frontend
  api/      NestJS backend
packages/
  shared/   Shared TypeScript types and DTOs
docs/       Architecture, setup, API plan, and task division
```

## Git Workflow

- Keep `main` deployable and protected.
- Create short-lived feature branches from `develop`.
- Use branch names like `feature/auth-api`, `feature/dashboard-ui`, and `fix/health-route`.
- Open pull requests into `develop`.
- Review each PR before merging.
- Merge `develop` into `main` only when a stable MVP milestone is ready.

## MVP Features

- User registration and login
- URL monitor CRUD
- Periodic URL health checks
- Check result history
- Automatic incident creation and resolution
- Realtime dashboard updates
- Email alerts
- Public status page
