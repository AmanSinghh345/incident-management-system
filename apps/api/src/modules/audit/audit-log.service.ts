import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { PrismaService } from "../prisma/prisma.service";

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  list(owner: AuthenticatedUser) {
    return this.prisma.auditLog.findMany({
      where: { workspaceOwnerId: owner.workspaceOwnerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async record(owner: AuthenticatedUser, input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        workspaceOwnerId: owner.workspaceOwnerId,
        actorId: owner.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata
      }
    });
  }
}
