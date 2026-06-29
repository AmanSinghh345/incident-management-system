# Setup Troubleshooting

## Prisma P1000 With Docker Postgres

Problem:

```text
P1000: Authentication failed against database server
```

In this project, Docker Postgres uses:

```text
POSTGRES_USER=pulseops
POSTGRES_PASSWORD=pulseops
POSTGRES_DB=pulseops
```

If `docker exec` can connect inside the container but Prisma still fails from Windows, the host port may be conflicting with another local PostgreSQL service or a stale connection path.

The project now maps Postgres like this:

```yaml
ports:
  - "5433:5432"
```

That means:

- Inside Docker, Postgres still listens on `5432`.
- From Windows/Prisma, connect through `127.0.0.1:5433`.

The required `DATABASE_URL` is:

```env
DATABASE_URL="postgresql://pulseops:pulseops@127.0.0.1:5433/pulseops?schema=public"
```

## Reset Local Docker Database

Use this only when you do not need local database data:

```powershell
docker compose down -v
docker compose up -d
pnpm db:migrate
```

`down -v` deletes the local Postgres and Redis volumes, then `up -d` recreates them using `docker-compose.yml`.

## Check Container Credentials

This verifies password auth inside the Postgres container:

```powershell
docker exec -e PGPASSWORD=pulseops pulseops-postgres psql -h 127.0.0.1 -U pulseops -d pulseops -c "select current_user, current_database();"
```

Expected result:

```text
current_user | current_database
pulseops     | pulseops
```
