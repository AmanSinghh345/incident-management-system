import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckStatus, IncidentStatus, MonitorStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class ChecksService {
  constructor(
    private readonly prisma: PrismaService,
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
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      statusCode = response.status;

      if (!response.ok) {
        errorMessage = `Unexpected status code ${response.status}.`;
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

    if (monitor.ownerId !== owner.id) {
      throw new ForbiddenException("You do not have access to this monitor.");
    }

    return monitor;
  }
}
