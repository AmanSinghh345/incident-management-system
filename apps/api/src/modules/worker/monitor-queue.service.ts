import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker, type ConnectionOptions } from "bullmq";
import { ChecksService } from "../checks/checks.service";
import { PrismaService } from "../prisma/prisma.service";

interface CheckMonitorJob {
  monitorId: string;
}

const CHECK_MONITOR_QUEUE = "monitor-checks";
const CHECK_MONITOR_JOB = "check-monitor";

@Injectable()
export class MonitorQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorQueueService.name);
  private connection?: ConnectionOptions;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly checksService: ChecksService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    this.connection = this.createRedisConnection();

    this.queue = new Queue(CHECK_MONITOR_QUEUE, {
      connection: this.connection
    });

    this.worker = new Worker(
      CHECK_MONITOR_QUEUE,
      (job: Job<CheckMonitorJob>) => this.processCheckJob(job),
      { connection: this.connection }
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Monitor check job ${job?.id ?? "unknown"} failed: ${error.message}`
      );
    });

    await this.scheduleExistingActiveMonitors();
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async scheduleMonitor(monitorId: string, delaySeconds?: number) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        id: true,
        intervalSeconds: true,
        isActive: true
      }
    });

    if (!monitor || !monitor.isActive || !this.queue) {
      return;
    }

    await this.removeScheduledMonitor(monitor.id);
    await this.queue.add(
      CHECK_MONITOR_JOB,
      { monitorId: monitor.id },
      {
        delay: (delaySeconds ?? monitor.intervalSeconds) * 1000,
        jobId: this.jobId(monitor.id),
        removeOnComplete: true,
        removeOnFail: 100
      }
    );
  }

  async removeScheduledMonitor(monitorId: string) {
    const delayedJobs = await this.queue?.getDelayed();
    const monitorJobs =
      delayedJobs?.filter(
        (job) =>
          job.name === CHECK_MONITOR_JOB &&
          job.data.monitorId === monitorId
      ) ?? [];

    await Promise.all(
      monitorJobs.map(async (job) => {
        try {
          await job.remove();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Could not remove scheduled monitor job ${job.id}: ${message}`
          );
        }
      })
    );
  }

  private async processCheckJob(job: Job<CheckMonitorJob>) {
    const { monitorId } = job.data;
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, isActive: true, intervalSeconds: true }
    });

    if (!monitor || !monitor.isActive) {
      return;
    }

    await this.checksService.runForMonitor(monitor.id);
    await this.scheduleMonitor(monitor.id);
  }

  private async scheduleExistingActiveMonitors() {
    const monitors = await this.prisma.monitor.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    const results = await Promise.allSettled(
      monitors.map((monitor) => this.scheduleMonitor(monitor.id, 5))
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const monitorId = monitors[index]?.id ?? "unknown";
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        this.logger.warn(`Could not schedule monitor ${monitorId}: ${message}`);
      }
    });

    if (monitors.length > 0) {
      this.logger.log(`Scheduled ${monitors.length} active monitor(s).`);
    }
  }

  private jobId(monitorId: string) {
    return `${CHECK_MONITOR_JOB}-${monitorId}-${Date.now()}`;
  }

  private createRedisConnection(): ConnectionOptions {
    const redisUrl = this.configService.get<string>("REDIS_URL");

    if (redisUrl) {
      const url = new URL(redisUrl);

      return {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        tls: url.protocol === "rediss:" ? {} : undefined,
        maxRetriesPerRequest: null
      };
    }

    return {
      host: this.configService.get<string>("REDIS_HOST") ?? "localhost",
      port: Number(this.configService.get<string>("REDIS_PORT") ?? 6379),
      maxRetriesPerRequest: null
    };
  }
}
