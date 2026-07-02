import { Injectable, NotFoundException } from "@nestjs/common";
import { CheckStatus, IncidentStatus, MonitorStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicStatus(workspaceSlug: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const owner = await this.prisma.user.findUnique({
      where: { workspaceSlug },
      select: {
        id: true,
        name: true,
        workspaceSlug: true,
        monitors: {
          where: { isPublic: true },
          orderBy: { createdAt: "asc" },
          include: {
            checkResults: {
              where: { checkedAt: { gte: last7d } },
              orderBy: { checkedAt: "desc" }
            },
            incidents: {
              where: {
                status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] }
              },
              orderBy: { startedAt: "desc" },
              take: 1,
              include: {
                updates: {
                  orderBy: { createdAt: "desc" },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    if (!owner) {
      throw new NotFoundException("Status page not found.");
    }

    const activeMonitors = owner.monitors.filter((monitor) => monitor.isActive);
    const activeIncidents = owner.monitors.flatMap((monitor) =>
      monitor.incidents.map((incident) => ({
        ...incident,
        monitor: {
          id: monitor.id,
          name: this.publicMonitorName(monitor),
          url: monitor.showUrl ? monitor.url : null,
          status: monitor.status
        }
      }))
    );
    const recentIncidents = await this.prisma.incident.findMany({
      where: {
        monitor: {
          ownerId: owner.id,
          isPublic: true
        }
      },
      orderBy: { startedAt: "desc" },
      take: 10,
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
            publicName: true,
            url: true,
            showUrl: true,
            status: true
          }
        },
        updates: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return {
      workspace: {
        name: owner.name,
        slug: owner.workspaceSlug
      },
      summary: {
        status: this.readOverallStatus(activeMonitors),
        totalMonitors: owner.monitors.length,
        activeMonitors: activeMonitors.length,
        openIncidents: activeIncidents.length
      },
      monitors: owner.monitors.map((monitor) => ({
        id: monitor.id,
        name: this.publicMonitorName(monitor),
        url: monitor.showUrl ? monitor.url : null,
        status: monitor.status,
        isActive: monitor.isActive,
        latestCheck: monitor.checkResults[0] ?? null,
        uptime: {
          last24h: this.summarizeUptime(
            monitor.checkResults.filter((result) => result.checkedAt >= last24h)
          ),
          last7d: this.summarizeUptime(monitor.checkResults)
        },
        activeIncident: monitor.incidents[0] ?? null
      })),
      incidents: activeIncidents,
      recentIncidents: recentIncidents.map((incident) => ({
        ...incident,
        monitor: {
          id: incident.monitor.id,
          name: this.publicMonitorName(incident.monitor),
          url: incident.monitor.showUrl ? incident.monitor.url : null,
          status: incident.monitor.status
        }
      })),
      generatedAt: new Date()
    };
  }

  private readOverallStatus(monitors: { status: MonitorStatus }[]) {
    if (monitors.length === 0) {
      return "NO_MONITORS";
    }

    if (monitors.some((monitor) => monitor.status === MonitorStatus.DOWN)) {
      return "MAJOR_OUTAGE";
    }

    if (monitors.some((monitor) => monitor.status === MonitorStatus.DEGRADED)) {
      return "PARTIAL_OUTAGE";
    }

    if (monitors.every((monitor) => monitor.status === MonitorStatus.PAUSED)) {
      return "PAUSED";
    }

    return "OPERATIONAL";
  }

  private summarizeUptime(
    results: { status: CheckStatus; responseTimeMs: number | null }[]
  ) {
    const totalChecks = results.length;
    const successfulChecks = results.filter(
      (result) => result.status === CheckStatus.SUCCESS
    ).length;
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
      uptimePercentage:
        totalChecks === 0
          ? null
          : Number(((successfulChecks / totalChecks) * 100).toFixed(2)),
      averageResponseTimeMs
    };
  }

  private publicMonitorName(monitor: { name: string; publicName: string | null }) {
    return monitor.publicName ?? monitor.name;
  }
}
