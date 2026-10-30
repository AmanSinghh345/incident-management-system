import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MonitorStatus, WorkspaceRole } from "@prisma/client";
import { MonitorsService, AuthenticatedUser } from "./monitors.service";

describe("MonitorsService", () => {
  let service: MonitorsService;

  const prisma = {
    monitor: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };

  const queue = {
    scheduleMonitor: jest.fn(),
    removeScheduledMonitor: jest.fn()
  };

  const realtime = {
    emitMonitorChanged: jest.fn(),
    emitMonitorDeleted: jest.fn()
  };

  const audit = {
    record: jest.fn()
  };

  const owner: AuthenticatedUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    workspaceSlug: "test-workspace",
    workspaceOwnerId: "owner-1",
    workspaceRole: WorkspaceRole.OWNER
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MonitorsService(
      prisma as any,
      queue as any,
      realtime as any,
      audit as any
    );
  });

  describe("create", () => {
    it("should create a monitor with default values", async () => {
      const createdMonitor = {
        id: "monitor-1",
        name: "My Website",
        url: "https://example.com/",
        method: "GET",
        expectedStatusCode: 200,
        timeoutSeconds: 5,
        isPublic: true,
        publicName: null,
        showUrl: false,
        intervalSeconds: 60,
        failureThreshold: 3,
        status: MonitorStatus.UP,
        isActive: true,
        ownerId: "owner-1"
      };

      prisma.monitor.create.mockResolvedValue(createdMonitor);

      const result = await service.create(owner, {
        name: "My Website",
        url: "https://example.com"
      });

      expect(prisma.monitor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "My Website",
          url: "https://example.com/",
          method: "GET",
          expectedStatusCode: 200,
          timeoutSeconds: 5,
          isPublic: true,
          showUrl: false,
          intervalSeconds: 60,
          failureThreshold: 3,
          status: MonitorStatus.UP,
          isActive: true,
          ownerId: "owner-1"
        })
      });

      expect(queue.scheduleMonitor).toHaveBeenCalledWith("monitor-1");
      expect(audit.record).toHaveBeenCalled();
      expect(realtime.emitMonitorChanged).toHaveBeenCalledWith(
        "owner-1",
        createdMonitor
      );

      expect(result).toEqual(createdMonitor);
    });

    it("should reject an invalid URL", async () => {
      await expect(
        service.create(owner, {
          name: "Invalid Monitor",
          url: "ftp://example.com"
        })
      ).rejects.toThrow(BadRequestException);

      expect(prisma.monitor.create).not.toHaveBeenCalled();
    });

    it("should reject a member who tries to create a monitor", async () => {
      const member = {
        ...owner,
        workspaceRole: WorkspaceRole.MEMBER
      };

      await expect(
        service.create(member, {
          name: "My Website",
          url: "https://example.com"
        })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.monitor.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid timeout", async () => {
      await expect(
        service.create(owner, {
          name: "My Website",
          url: "https://example.com",
          timeoutSeconds: 100
        })
      ).rejects.toThrow(BadRequestException);

      expect(prisma.monitor.create).not.toHaveBeenCalled();
    });

    it("should allow an admin to create a monitor", async () => {
      const admin = { ...owner, workspaceRole: WorkspaceRole.ADMIN };
      const createdMonitor = {
        id: "monitor-2",
        name: "Admin Monitor",
        url: "https://example.com/",
        ownerId: "owner-1"
      };

      prisma.monitor.create.mockResolvedValue(createdMonitor);

      const result = await service.create(admin, {
        name: "Admin Monitor",
        url: "https://example.com"
      });

      expect(prisma.monitor.create).toHaveBeenCalled();
      expect(queue.scheduleMonitor).toHaveBeenCalledWith("monitor-2");
      expect(result).toEqual(createdMonitor);
    });

    it.each([
      ["missing name", { url: "https://example.com" }],
      ["empty name", { name: "   ", url: "https://example.com" }],
      ["missing URL", { name: "Website" }],
      ["invalid URL format", { name: "Website", url: "not-a-url" }],
      ["non-HTTP URL", { name: "Website", url: "ftp://example.com" }],
      ["invalid method", { name: "Website", url: "https://example.com", method: "PUT" }],
      ["non-string method", { name: "Website", url: "https://example.com", method: 123 }],
      ["invalid expected status code", { name: "Website", url: "https://example.com", expectedStatusCode: 99 }],
      ["non-integer timeout", { name: "Website", url: "https://example.com", timeoutSeconds: 2.5 }],
      ["invalid public flag", { name: "Website", url: "https://example.com", isPublic: "true" }],
      ["invalid showUrl flag", { name: "Website", url: "https://example.com", showUrl: 1 }],
      ["invalid interval", { name: "Website", url: "https://example.com", intervalSeconds: 10 }],
      ["invalid failure threshold", { name: "Website", url: "https://example.com", failureThreshold: 11 }],
      ["non-string public name", { name: "Website", url: "https://example.com", publicName: 123 }]
    ])("should reject %s", async (_label, body) => {
      await expect(service.create(owner, body)).rejects.toThrow(BadRequestException);
      expect(prisma.monitor.create).not.toHaveBeenCalled();
    });

    it("should create a monitor with custom configuration", async () => {
      const createdMonitor = {
        id: "monitor-3",
        name: "Custom Monitor",
        url: "https://example.com/",
        method: "POST",
        expectedStatusCode: 201,
        timeoutSeconds: 10,
        isPublic: false,
        publicName: "Public API",
        showUrl: true,
        intervalSeconds: 120,
        failureThreshold: 5,
        status: MonitorStatus.UP,
        isActive: true,
        ownerId: "owner-1"
      };

      prisma.monitor.create.mockResolvedValue(createdMonitor);

      await service.create(owner, {
        name: "Custom Monitor",
        url: "https://example.com",
        method: "post",
        expectedStatusCode: 201,
        timeoutSeconds: 10,
        isPublic: false,
        publicName: "Public API",
        showUrl: true,
        intervalSeconds: 120,
        failureThreshold: 5
      });

      expect(prisma.monitor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Custom Monitor",
          url: "https://example.com/",
          method: "POST",
          expectedStatusCode: 201,
          timeoutSeconds: 10,
          isPublic: false,
          publicName: "Public API",
          showUrl: true,
          intervalSeconds: 120,
          failureThreshold: 5
        })
      });
    });

    it("should convert an empty public name to null", async () => {
      prisma.monitor.create.mockResolvedValue({ id: "monitor-4" });

      await service.create(owner, {
        name: "Website",
        url: "https://example.com",
        publicName: "   "
      });

      expect(prisma.monitor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          publicName: null
        })
      });
    });
  });

  describe("update", () => {
    const existingMonitor = {
      id: "monitor-1",
      name: "My Website",
      url: "https://example.com/",
      ownerId: "owner-1",
      isActive: true,
      status: MonitorStatus.UP
    };

    beforeEach(() => {
      prisma.monitor.findUnique.mockResolvedValue(existingMonitor);
      prisma.monitor.update.mockResolvedValue({
        ...existingMonitor,
        name: "Updated Website"
      });
    });

    it("should update monitor details", async () => {
      const result = await service.update(owner, "monitor-1", {
        name: "Updated Website"
      });

      expect(prisma.monitor.update).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        data: { name: "Updated Website" }
      });
      expect(queue.scheduleMonitor).toHaveBeenCalledWith("monitor-1");
      expect(audit.record).toHaveBeenCalled();
      expect(realtime.emitMonitorChanged).toHaveBeenCalled();
      expect(result.name).toBe("Updated Website");
    });

    it("should pause a monitor and remove its scheduled job", async () => {
      prisma.monitor.update.mockResolvedValue({
        ...existingMonitor,
        isActive: false,
        status: MonitorStatus.PAUSED
      });

      const result = await service.update(owner, "monitor-1", {
        isActive: false
      });

      expect(prisma.monitor.update).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        data: { isActive: false, status: MonitorStatus.PAUSED }
      });
      expect(queue.removeScheduledMonitor).toHaveBeenCalledWith("monitor-1");
      expect(queue.scheduleMonitor).not.toHaveBeenCalled();
      expect(result.status).toBe(MonitorStatus.PAUSED);
    });

    it("should resume a paused monitor and schedule its job", async () => {
      prisma.monitor.update.mockResolvedValue({
        ...existingMonitor,
        isActive: true,
        status: MonitorStatus.UP
      });

      await service.update(owner, "monitor-1", { isActive: true });

      expect(queue.scheduleMonitor).toHaveBeenCalledWith("monitor-1");
      expect(queue.removeScheduledMonitor).not.toHaveBeenCalled();
    });

    it("should prevent a member from updating a monitor", async () => {
      const member = { ...owner, workspaceRole: WorkspaceRole.MEMBER };

      await expect(
        service.update(member, "monitor-1", { name: "Unauthorized Update" })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.monitor.update).not.toHaveBeenCalled();
    });

    it.each([
      ["empty name", { name: "   " }],
      ["invalid URL", { url: "invalid-url" }],
      ["invalid method", { method: "PUT" }],
      ["non-integer expected status", { expectedStatusCode: 200.5 }],
      ["out-of-range expected status", { expectedStatusCode: 600 }],
      ["invalid timeout", { timeoutSeconds: 0 }],
      ["invalid isPublic", { isPublic: "true" }],
      ["invalid publicName", { publicName: 123 }],
      ["invalid showUrl", { showUrl: "false" }],
      ["invalid interval", { intervalSeconds: 20 }],
      ["invalid failure threshold", { failureThreshold: 11 }],
      ["invalid isActive", { isActive: "false" }]
    ])("should reject %s", async (_label, body) => {
      await expect(
        service.update(owner, "monitor-1", body)
      ).rejects.toThrow(BadRequestException);
      expect(prisma.monitor.update).not.toHaveBeenCalled();
    });

    it("should update all supported fields", async () => {
      const updatedMonitor = {
        ...existingMonitor,
        name: "Updated",
        url: "https://new-example.com/",
        method: "POST",
        expectedStatusCode: 201,
        timeoutSeconds: 10,
        isPublic: false,
        publicName: "API",
        showUrl: true,
        intervalSeconds: 120,
        failureThreshold: 5
      };

      prisma.monitor.update.mockResolvedValue(updatedMonitor);

      await service.update(owner, "monitor-1", {
        name: "Updated",
        url: "https://new-example.com",
        method: "post",
        expectedStatusCode: 201,
        timeoutSeconds: 10,
        isPublic: false,
        publicName: "API",
        showUrl: true,
        intervalSeconds: 120,
        failureThreshold: 5
      });

      expect(prisma.monitor.update).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        data: {
          name: "Updated",
          url: "https://new-example.com/",
          method: "POST",
          expectedStatusCode: 201,
          timeoutSeconds: 10,
          isPublic: false,
          publicName: "API",
          showUrl: true,
          intervalSeconds: 120,
          failureThreshold: 5
        }
      });
    });

    it("should convert an empty public name to null", async () => {
      await service.update(owner, "monitor-1", { publicName: "   " });

      expect(prisma.monitor.update).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        data: { publicName: null }
      });
    });

    it("should reject updating a monitor that does not exist", async () => {
      prisma.monitor.findUnique.mockResolvedValue(null);

      await expect(
        service.update(owner, "missing-monitor", { name: "Updated" })
      ).rejects.toThrow(NotFoundException);

      expect(prisma.monitor.update).not.toHaveBeenCalled();
    });

    it("should reject updating another workspace's monitor", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        ...existingMonitor,
        ownerId: "another-owner"
      });

      await expect(
        service.update(owner, "monitor-1", { name: "Updated" })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.monitor.update).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("should return monitors belonging to the workspace owner", async () => {
      const monitors = [
        { id: "monitor-1", name: "My Website", ownerId: "owner-1" }
      ];
      prisma.monitor.findMany.mockResolvedValue(monitors);

      const result = await service.list(owner);

      expect(prisma.monitor.findMany).toHaveBeenCalledWith({
        where: { ownerId: "owner-1" },
        orderBy: { createdAt: "desc" },
        include: {
          checkResults: {
            orderBy: { checkedAt: "desc" },
            take: 1
          },
          incidents: {
            where: {
              status: { in: ["OPEN", "ACKNOWLEDGED"] }
            },
            orderBy: { startedAt: "desc" },
            take: 1
          }
        }
      });
      expect(result).toEqual(monitors);
    });
  });

  describe("getForOwner", () => {
    it("should return a monitor belonging to the owner", async () => {
      const monitor = { id: "monitor-1", name: "My Website", ownerId: "owner-1" };
      prisma.monitor.findUnique.mockResolvedValue(monitor);

      const result = await service.getForOwner(owner, "monitor-1");

      expect(prisma.monitor.findUnique).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        include: {
          checkResults: {
            orderBy: { checkedAt: "desc" },
            take: 10
          },
          incidents: {
            orderBy: { startedAt: "desc" },
            take: 10
          }
        }
      });
      expect(result).toEqual(monitor);
    });

    it("should reject when monitor does not exist", async () => {
      prisma.monitor.findUnique.mockResolvedValue(null);

      await expect(
        service.getForOwner(owner, "invalid-monitor")
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject access to another owner's monitor", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-2",
        ownerId: "another-owner"
      });

      await expect(
        service.getForOwner(owner, "monitor-2")
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("delete", () => {
    const existingMonitor = {
      id: "monitor-1",
      name: "My Website",
      url: "https://example.com/",
      ownerId: "owner-1"
    };

    beforeEach(() => {
      prisma.monitor.findUnique.mockResolvedValue(existingMonitor);
    });

    it("should delete a monitor and clean up its scheduled job", async () => {
      prisma.monitor.delete.mockResolvedValue({ id: "monitor-1" });

      const result = await service.delete(owner, "monitor-1");

      expect(queue.removeScheduledMonitor).toHaveBeenCalledWith("monitor-1");
      expect(prisma.monitor.delete).toHaveBeenCalledWith({
        where: { id: "monitor-1" }
      });
      expect(audit.record).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          action: "monitor.deleted",
          entityType: "monitor",
          entityId: "monitor-1"
        })
      );
      expect(realtime.emitMonitorDeleted).toHaveBeenCalledWith("owner-1", "monitor-1");
      expect(result).toEqual({ deleted: true });
    });

    it("should prevent a member from deleting a monitor", async () => {
      const member = { ...owner, workspaceRole: WorkspaceRole.MEMBER };

      await expect(
        service.delete(member, "monitor-1")
      ).rejects.toThrow(ForbiddenException);

      expect(queue.removeScheduledMonitor).not.toHaveBeenCalled();
      expect(prisma.monitor.delete).not.toHaveBeenCalled();
    });

    it("should reject when monitor does not exist", async () => {
      prisma.monitor.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.delete(owner, "missing-monitor")
      ).rejects.toThrow(NotFoundException);

      expect(prisma.monitor.delete).not.toHaveBeenCalled();
    });

    it("should reject deleting another workspace's monitor", async () => {
      prisma.monitor.findUnique.mockResolvedValueOnce({
        ...existingMonitor,
        ownerId: "another-owner"
      });

      await expect(
        service.delete(owner, "monitor-1")
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.monitor.delete).not.toHaveBeenCalled();
    });
  });
});