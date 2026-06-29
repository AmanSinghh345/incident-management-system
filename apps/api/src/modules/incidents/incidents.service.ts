import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { IncidentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(owner: AuthenticatedUser) {
    return this.prisma.incident.findMany({
      where: {
        monitor: {
          ownerId: owner.id
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

    if (incident.monitor.ownerId !== owner.id) {
      throw new ForbiddenException("You do not have access to this incident.");
    }

    return incident;
  }

  async acknowledge(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    return this.prisma.incident.update({
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
  }

  async resolve(owner: AuthenticatedUser, incidentId: string) {
    await this.get(owner, incidentId);

    return this.prisma.incident.update({
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
  }
}
