import { Test } from "@nestjs/testing";
import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceRole } from "@prisma/client";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let prisma: {
    auditLog: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };

  const owner = {
    id: "user-1",
    name: "Test User", // Added missing name property
    workspaceOwnerId: "owner-1",
    workspaceSlug: "test-workspace",
    email: "owner@test.com",
    workspaceRole: WorkspaceRole.OWNER
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn()
      }
    };

    const module = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe("list", () => {
    it("should return audit logs for the workspace owner", async () => {
      const logs = [
        { id: "log-1", action: "monitor.created" },
        { id: "log-2", action: "monitor.updated" }
      ];

      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.list(owner);

      expect(result).toEqual(logs);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
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
    });

    it("should return an empty array when no logs exist", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.list(owner);

      expect(result).toEqual([]);
    });
  });

  describe("record", () => {
    it("should create an audit log with the correct details", async () => {
      prisma.auditLog.create.mockResolvedValue({ id: "log-1" });

      await service.record(owner, {
        action: "monitor.created",
        entityType: "monitor",
        entityId: "monitor-1",
        summary: "Created monitor API.",
        metadata: { url: "https://example.com" }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceOwnerId: owner.workspaceOwnerId,
          actorId: owner.id,
          action: "monitor.created",
          entityType: "monitor",
          entityId: "monitor-1",
          summary: "Created monitor API.",
          metadata: { url: "https://example.com" }
        }
      });
    });

    it("should set entityId to null when it is not provided", async () => {
      prisma.auditLog.create.mockResolvedValue({ id: "log-2" });

      await service.record(owner, {
        action: "workspace.updated",
        entityType: "workspace",
        summary: "Updated workspace."
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceOwnerId: owner.workspaceOwnerId,
          actorId: owner.id,
          action: "workspace.updated",
          entityType: "workspace",
          entityId: null,
          summary: "Updated workspace.",
          metadata: undefined
        }
      });
    });

    it("should propagate database errors", async () => {
      prisma.auditLog.create.mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(
        service.record(owner, {
          action: "monitor.created",
          entityType: "monitor",
          entityId: "monitor-1",
          summary: "Created monitor."
        })
      ).rejects.toThrow("Database connection failed");
    });
  });
});