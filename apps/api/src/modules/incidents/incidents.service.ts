import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { RealtimeService } from "../realtime/realtime.service";
import { TeamService } from "../team/team.service";

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
    private readonly teamService: TeamService,
    private readonly auditLogService: AuditLogService
  ) {}

  list(owner: AuthenticatedUser) {
    return this.prisma.incident.findMany({
      where: {
        monitor: {
          ownerId: owner.workspaceOwnerId
        }
      },
      orderBy: { startedAt: "desc" },
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
            url: true,
            status: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  async get(owner: AuthenticatedUser, incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        monitor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        notifications: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!incident) {
      throw new NotFoundException("Incident not found.");
    }

    if (incident.monitor.ownerId !== owner.workspaceOwnerId) {
      throw new ForbiddenException("You do not have access to this incident.");
    }

    return incident;
  }

  async acknowledge(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        updates: {
          create: {
            authorId: owner.id,
            message: "Incident acknowledged."
          }
        }
      },
      include: {
        monitor: true,
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.acknowledged",
      entityType: "incident",
      entityId: incident.id,
      summary: `Acknowledged incident ${incident.title}.`
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async resolve(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        updates: {
          create: {
            authorId: owner.id,
            message: "Incident manually resolved."
          }
        }
      },
      include: {
        monitor: true,
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.resolved",
      entityType: "incident",
      entityId: incident.id,
      summary: `Resolved incident ${incident.title}.`
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async updateSeverity(
    owner: AuthenticatedUser,
    incidentId: string,
    body: { severity?: unknown }
  ) {
    await this.get(owner, incidentId);
    const severity = this.readSeverity(body.severity);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        severity,
        updates: {
          create: {
            authorId: owner.id,
            message: `Severity changed to ${severity}.`
          }
        }
      },
      include: {
        monitor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.severity_updated",
      entityType: "incident",
      entityId: incident.id,
      summary: `Changed incident severity to ${severity}.`,
      metadata: { severity }
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async assignToMe(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        assignedToId: owner.id,
        updates: {
          create: {
            authorId: owner.id,
            message: `Assigned to ${owner.name}.`
          }
        }
      },
      include: {
        monitor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.assigned",
      entityType: "incident",
      entityId: incident.id,
      summary: `Assigned incident ${incident.title} to ${owner.name}.`,
      metadata: { assignedToId: owner.id }
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async assignToMember(
    owner: AuthenticatedUser,
    incidentId: string,
    body: { userId?: unknown }
  ) {
    await this.get(owner, incidentId);
    const userId = this.readRequiredString(body.userId, "userId");
    const member = await this.teamService.assertWorkspaceMember(owner, userId);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        assignedToId: member.userId,
        updates: {
          create: {
            authorId: owner.id,
            message: `Assigned to ${member.user.name}.`
          }
        }
      },
      include: {
        monitor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.assigned",
      entityType: "incident",
      entityId: incident.id,
      summary: `Assigned incident ${incident.title} to ${member.user.name}.`,
      metadata: { assignedToId: member.userId }
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async unassign(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        assignedToId: null,
        updates: {
          create: {
            authorId: owner.id,
            message: "Incident unassigned."
          }
        }
      },
      include: {
        monitor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updates: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await this.auditLogService.record(owner, {
      action: "incident.unassigned",
      entityType: "incident",
      entityId: incident.id,
      summary: `Unassigned incident ${incident.title}.`
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return incident;
  }

  async addUpdate(
    owner: AuthenticatedUser,
    incidentId: string,
    body: { message?: unknown }
  ) {
    await this.get(owner, incidentId);
    const message = this.readUpdateMessage(body.message);

    const update = await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        authorId: owner.id,
        message
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    const incident = await this.get(owner, incidentId);

    await this.auditLogService.record(owner, {
      action: "incident.update_added",
      entityType: "incident",
      entityId: incidentId,
      summary: "Added an incident timeline update.",
      metadata: { message }
    });
    this.realtimeService.emitIncidentChanged(owner.workspaceOwnerId, incident);

    return update;
  }

  private readUpdateMessage(value: unknown) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException("message is required.");
    }

    if (value.trim().length > 1000) {
      throw new BadRequestException("message must be 1000 characters or fewer.");
    }

    return value.trim();
  }

  private readRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private readSeverity(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("severity is required.");
    }

    const severity = value.trim().toUpperCase();

    if (!Object.values(IncidentSeverity).includes(severity as IncidentSeverity)) {
      throw new BadRequestException("severity must be LOW, MEDIUM, HIGH, or CRITICAL.");
    }

    return severity as IncidentSeverity;
  }
}
