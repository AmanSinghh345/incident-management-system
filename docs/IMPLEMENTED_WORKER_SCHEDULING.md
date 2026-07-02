# Implemented Worker Scheduling

## What was added

The backend now has BullMQ-based automatic monitor scheduling.

Before this, checks only ran when the user clicked:

```text
POST /monitors/:id/check-now
```

Now active monitors are also scheduled through Redis/BullMQ.

## Files to study

- `apps/api/src/modules/worker/monitor-queue.service.ts`
- `apps/api/src/modules/worker/worker.module.ts`
- `apps/api/src/modules/checks/checks.service.ts`
- `apps/api/src/modules/monitors/monitors.service.ts`
- `apps/api/src/modules/monitors/monitors.module.ts`

## Main idea

The worker uses a delayed-job loop:

1. A monitor is created.
2. Backend schedules one BullMQ delayed job for that monitor.
3. Worker processes the job when the delay expires.
4. Worker calls the same check logic used by manual Check Now.
5. Worker schedules the next delayed job using `intervalSeconds`.

This keeps the logic easy to understand:

```text
monitor -> delayed job -> worker check -> save result -> schedule next job
```

## Why delayed jobs instead of repeatable jobs?

BullMQ repeatable jobs can handle this use case, but updating or removing repeatable schedules is more complex.

Delayed jobs are simpler for Week 1:

- One job id per monitor.
- Pause removes the scheduled job.
- Resume schedules a new one.
- Interval changes reschedule the next job.
- Delete removes the scheduled job.

## Queue name

```text
monitor-checks
```

## Job name

```text
check-monitor
```

## Job id format

```text
check-monitor-<monitorId>
```

This prevents duplicate delayed jobs for the same monitor. BullMQ custom job ids cannot contain `:`, so the worker uses `-` as the separator.

## When jobs are scheduled

Jobs are scheduled when:

- API starts and finds existing active monitors.
- A monitor is created.
- A monitor is updated and remains active.
- A paused monitor is resumed.
- A worker finishes a check and schedules the next check.

Jobs are removed when:

- A monitor is paused.
- A monitor is deleted.

## Shared check logic

`ChecksService` now exposes:

```ts
runForMonitor(monitorId)
```

Manual checks and worker checks both use the same monitor status, CheckResult, and incident logic.

That prevents two different implementations of the same core behavior.

## Environment variables

The worker reads Redis config from:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Redis must be running:

```powershell
docker compose up -d
```

## How to test

1. Start Docker:

```powershell
docker compose up -d
```

2. Start API:

```powershell
pnpm dev:api
```

3. Create a monitor with a small interval, for example 30 seconds.
4. Wait for the interval.
5. Refresh monitor detail/check history.

You should see new check results appear without clicking Run Check.

## What is still missing

- Separate worker process command.
- Worker dashboard/queue visibility.
- Retry/backoff configuration.
- Better degraded/timeout rules.
- Production-grade queue monitoring.
