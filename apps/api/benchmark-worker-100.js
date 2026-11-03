const { Queue } = require("bullmq");
const { PrismaClient } = require("@prisma/client");
const { performance } = require("perf_hooks");

const DATABASE_URL =
  "postgresql://pulseops_test:pulseops_test@localhost:5434/pulseops_load?schema=public";

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const queue = new Queue("monitor-checks", {
  connection: {
    host: "localhost",
    port: 6380,
    maxRetriesPerRequest: null,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const monitors = await prisma.monitor.findMany({
    where: {
      isActive: true,
      OR: Array.from({ length: 100 }, (_, i) => ({
        name: `Worker Benchmark ${i + 1}`,
      })),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (monitors.length !== 100) {
    throw new Error(`Expected 100 active monitors, found ${monitors.length}`);
  }

  const ids = monitors.map((m) => m.id);

  const baselineRows = await prisma.checkResult.groupBy({
    by: ["monitorId"],
    where: { monitorId: { in: ids } },
    _count: { _all: true },
  });

  const baseline = new Map(
    baselineRows.map((r) => [r.monitorId, r._count._all])
  );

  const checksPerMonitor = 10;
  const totalExpectedChecks = monitors.length * checksPerMonitor;

  console.log(`Benchmark monitors: ${monitors.length}`);
  console.log(`Enqueuing ${totalExpectedChecks} immediate jobs (${checksPerMonitor} per monitor)...`);

  const start = performance.now();
  const startedAt = new Date();

  for (let round = 1; round <= checksPerMonitor; round++) {
    for (const monitor of monitors) {
      await queue.add(
        "check-monitor",
        { monitorId: monitor.id },
        {
          jobId: `worker-bench-1000-${round}-${monitor.id}`,
          removeOnComplete: true,
          removeOnFail: 100,
        }
      );
    }
  }

  console.log("All 1000 jobs enqueued. Waiting for worker...");

  let completed = 0;
  let elapsed = 0;

  while (elapsed < 180000) {
    await sleep(200);

    const rows = await prisma.checkResult.groupBy({
      by: ["monitorId"],
      where: { monitorId: { in: ids } },
      _count: { _all: true },
    });

    const current = new Map(
      rows.map((r) => [r.monitorId, r._count._all])
    );

    completed = ids.filter(
      (id) => (current.get(id) || 0) >= (baseline.get(id) || 0) + checksPerMonitor
    ).length;

    elapsed = performance.now() - start;

    if (completed === 100) break;
  }

  const seconds = elapsed / 1000;

  const results = await prisma.checkResult.groupBy({
    by: ["status"],
    where: {
      monitorId: { in: ids },
      checkedAt: { gte: startedAt },
    },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    results.map((r) => [r.status, r._count._all])
  );

  const totalChecks = (counts.SUCCESS || 0) + (counts.FAILURE || 0);

  console.log("\n========== WORKER BENCHMARK (1000 JOBS) ==========");
  console.log("Completed monitors:", `${completed}/100`);
  console.log("Elapsed seconds:", seconds.toFixed(2));
  console.log("Total checks recorded:", totalChecks);
  console.log(
    "Throughput:",
    ((totalChecks / seconds) * 60).toFixed(2),
    "checks/min"
  );
  console.log("Successful checks:", counts.SUCCESS || 0);
  console.log("Failed checks:", counts.FAILURE || 0);
  console.log("==================================================");
}

main()
  .catch(console.error)
  .finally(async () => {
    await queue.close();
    await prisma.$disconnect();
  });