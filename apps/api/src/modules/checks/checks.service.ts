import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckStatus, IncidentStatus, MonitorStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class ChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService
  ) {}

  async listForMonitor(owner: AuthenticatedUser, monitorId: string) {
    await this.assertMonitorOwner(owner, monitorId);

    return this.prisma.checkResult.findMany({
      where: { monitorId },
      orderBy: { checkedAt: "desc" },
      take: 50
    });
  }

  async getStatsForMonitor(owner: AuthenticatedUser, monitorId: string) {
    await this.assertMonitorOwner(owner, monitorId);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const results = await this.prisma.checkResult.findMany({
      where: {
        monitorId,
        checkedAt: { gte: last7d }
      },
      orderBy: { checkedAt: "asc" }
    });
    const results24h = results.filter((result) => result.checkedAt >= last24h);

    return {
      window: {
        generatedAt: now,
        last24hStart: last24h,
        last7dStart: last7d
      },
      last24h: this.summarizeResults(results24h),
      last7d: this.summarizeResults(results),
      hourlyTimeline: this.buildHourlyTimeline(results24h, last24h, now)
    };
  }

  async runNow(owner: AuthenticatedUser, monitorId: string) {
    await this.assertMonitorOwner(owner, monitorId);

    return this.runForMonitor(monitorId);
  }

  async runForMonitor(monitorId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId }
    });

    if (!monitor) {
      throw new NotFoundException("Monitor not found.");
    }

    if (!monitor.isActive || monitor.status === MonitorStatus.PAUSED) {
      const checkResult = await this.prisma.checkResult.create({
        data: {
          monitorId,
          status: CheckStatus.FAILURE,
          errorMessage: "Monitor is paused."
        }
      });
      const payload = {
        monitor,
        checkResult,
        incident: null
      };

      this.realtimeService.emitCheckCreated(monitor.ownerId, payload);

      return payload;
    }

    const checkedAt = new Date();
    const startedAt = Date.now();
    let statusCode: number | undefined;
    let errorMessage: string | undefined;

    try {
      const response = await fetch(monitor.url, {
        method: monitor.method,
        signal: AbortSignal.timeout(monitor.timeoutSeconds * 1000)
      });
      statusCode = response.status;

      if (response.status !== monitor.expectedStatusCode) {
        errorMessage = `Expected status code ${monitor.expectedStatusCode}, received ${response.status}.`;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Request failed.";
    }

    const responseTimeMs = Date.now() - startedAt;
    const isSuccess = !errorMessage;
    const checkResult = await this.prisma.checkResult.create({
      data: {
        monitorId,
        status: isSuccess ? CheckStatus.SUCCESS : CheckStatus.FAILURE,
        statusCode,
        responseTimeMs,
        errorMessage,
        checkedAt
      }
    });

    const recentResults = await this.prisma.checkResult.findMany({
      where: { monitorId },
      orderBy: { checkedAt: "desc" },
      take: monitor.failureThreshold
    });
    const shouldOpenIncident =
      recentResults.length >= monitor.failureThreshold &&
      recentResults.every((result) => result.status === CheckStatus.FAILURE);

    const activeIncident = await this.prisma.incident.findFirst({
      where: {
        monitorId,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] }
      },
      orderBy: { startedAt: "desc" }
    });

    let incident = activeIncident;

    if (isSuccess) {
      const updatedMonitor = await this.prisma.monitor.update({
        where: { id: monitorId },
        data: { status: MonitorStatus.UP }
      });

      if (activeIncident) {
        incident = await this.prisma.incident.update({
          where: { id: activeIncident.id },
          data: {
            status: IncidentStatus.RESOLVED,
            resolvedAt: new Date(),
            updates: {
              create: {
                message: "Incident auto-resolved after a successful check."
              }
            }
          }
        });
        await this.notificationsService.sendIncidentResolved(incident.id);
      }

      const payload = {
        monitor: updatedMonitor,
        checkResult,
        incident
      };

      this.realtimeService.emitCheckCreated(updatedMonitor.ownerId, payload);

      if (incident) {
        this.realtimeService.emitIncidentChanged(updatedMonitor.ownerId, incident);
      }

      return payload;
    }

    const updatedMonitor = await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { status: MonitorStatus.DOWN }
    });

    if (shouldOpenIncident && !activeIncident) {
      incident = await this.prisma.incident.create({
        data: {
          monitorId,
          title: `${monitor.name} is down`,
          status: IncidentStatus.OPEN,
          updates: {
            create: {
              message: errorMessage ?? "Monitor check failed."
            }
          }
        }
      });
      await this.notificationsService.sendIncidentOpened(incident.id);
    }

    const payload = {
      monitor: updatedMonitor,
      checkResult,
      incident
    };

    this.realtimeService.emitCheckCreated(updatedMonitor.ownerId, payload);

    if (incident) {
      this.realtimeService.emitIncidentChanged(updatedMonitor.ownerId, incident);
    }

    return payload;
  }

  private async assertMonitorOwner(owner: AuthenticatedUser, monitorId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId }
    });

    if (!monitor) {
      throw new NotFoundException("Monitor not found.");
    }

    if (monitor.ownerId !== owner.workspaceOwnerId) {
      throw new ForbiddenException("You do not have access to this monitor.");
    }

    return monitor;
  }

  private summarizeResults(results: { status: CheckStatus; responseTimeMs: number | null }[]) {
    const totalChecks = results.length;
    const failedChecks = results.filter(
      (result) => result.status === CheckStatus.FAILURE
    ).length;
    const successfulChecks = totalChecks - failedChecks;
    const timedResults = results.filter(
      (result): result is { status: CheckStatus; responseTimeMs: number } =>
        typeof result.responseTimeMs === "number"
    );
    const averageResponseTimeMs =
      timedResults.length === 0
        ? null
        : Math.round(
            timedResults.reduce((sum, result) => sum + result.responseTimeMs, 0) /
              timedResults.length
          );

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      uptimePercentage:
        totalChecks === 0 ? null : Number(((successfulChecks / totalChecks) * 100).toFixed(2)),
      averageResponseTimeMs
    };
  }

  private buildHourlyTimeline(
    results: { status: CheckStatus; responseTimeMs: number | null; checkedAt: Date }[],
    start: Date,
    end: Date
  ) {
    const bucketCount = 24;
    const bucketSizeMs = (end.getTime() - start.getTime()) / bucketCount;

    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start.getTime() + index * bucketSizeMs);
      const bucketEnd = new Date(start.getTime() + (index + 1) * bucketSizeMs);
      const bucketResults = results.filter(
        (result) => result.checkedAt >= bucketStart && result.checkedAt < bucketEnd
      );
      const summary = this.summarizeResults(bucketResults);

      return {
        start: bucketStart,
        end: bucketEnd,
        ...summary
      };
    });
  }
}
