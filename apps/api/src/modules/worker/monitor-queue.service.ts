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
    this.connection = {
      host: this.configService.get<string>("REDIS_HOST") ?? "localhost",
      port: Number(this.configService.get<string>("REDIS_PORT") ?? 6379),
      maxRetriesPerRequest: null
    };

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
    const delayedJob = await this.queue?.getJob(this.jobId(monitorId));
    await delayedJob?.remove();
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

    await Promise.all(
      monitors.map((monitor) => this.scheduleMonitor(monitor.id, 5))
    );

    if (monitors.length > 0) {
      this.logger.log(`Scheduled ${monitors.length} active monitor(s).`);
    }
  }

  private jobId(monitorId: string) {
    return `${CHECK_MONITOR_JOB}-${monitorId}`;
  }
}
