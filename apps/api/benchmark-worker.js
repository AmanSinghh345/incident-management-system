
const { Queue } = require("bullmq");
const { PrismaClient } = require("@prisma/client");
const { performance } = require("perf_hooks");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://pulseops_test:pulseops_test@localhost:5434/pulseops_load?schema=public",
    },
  },
});

const queue = new Queue("monitor-checks", {
  connection: { host: "localhost", port: 6380 },
});

const monitorIds = [
  "cmvuvbu8y006lmt4g47knrv5n",
  "cmvuvbuav006pmt4gorutu85m",
  "cmvuvbubw006tmt4gy0uj9otu",
  "cmvuvbud1006xmt4g999poi4a",
  "cmvuvbue80071mt4gy9a263rs",
  "cmvuvbufa0075mt4gnrx9oqum",
  "cmvuvbug90079mt4g6e1p2cz3",
  "cmvuvbuh9007dmt4gng4ejv1q",
  "cmvuvbui3007hmt4gfvvixlwu",
  "cmvuvbujs007lmt4g6oprnh3v",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const baseline = await Promise.all(
    monitorIds.map((monitorId) =>
      prisma.checkResult.count({ where: { monitorId } })
    )
  );

  const start = performance.now();

  for (const monitorId of monitorIds) {
    await queue.add(
      "check-monitor",
      { monitorId },
      {
        jobId: `worker-bench-${monitorId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
  }

  console.log("Enqueued 10 immediate jobs. Waiting for completion...");

  let counts = baseline;

  while (performance.now() - start < 120000) {
    await sleep(250);

    counts = await Promise.all(
      monitorIds.map((monitorId) =>
        prisma.checkResult.count({ where: { monitorId } })
      )
    );

    if (counts.every((count, i) => count >= baseline[i] + 1)) {
      break;
    }
  }

  const elapsed = (performance.now() - start) / 1000;
  const completed = counts.filter(
    (count, i) => count >= baseline[i] + 1
  ).length;

  console.log("Completed checks:", completed, "/ 10");
  console.log("Elapsed seconds:", elapsed.toFixed(2));
  console.log(
    "Throughput:",
    (completed / elapsed * 60).toFixed(2),
    "checks/min"
  );

  if (completed < 10) {
    console.log("Some jobs did not complete within 120 seconds.");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await queue.close();
    await prisma.$disconnect();
  });
