import { Test } from "@nestjs/testing";
import { ChecksService } from "./checks.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";
import {
  CheckStatus,
  IncidentStatus,
  MonitorStatus
} from "@prisma/client";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

describe("ChecksService", () => {
  let service: ChecksService;

  let prisma: any;
  let notifications: any;
  let realtime: any;

  beforeEach(async () => {
    prisma = {
      monitor: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      checkResult: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      incident: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    notifications = {
      sendIncidentOpened: jest.fn(),
      sendIncidentResolved: jest.fn()
    };

    realtime = {
      emitCheckCreated: jest.fn(),
      emitIncidentChanged: jest.fn()
    };

    const module = await Test.createTestingModule({
      providers: [
        ChecksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: RealtimeService, useValue: realtime }
      ]
    }).compile();

    service = module.get<ChecksService>(ChecksService);
  });

  it("should create incident after failure threshold", async () => {
    const monitor = {
      id: "m1",
      name: "Test Monitor",
      url: "https://example.com",
      method: "GET",
      expectedStatusCode: 200,
      timeoutSeconds: 5,
      failureThreshold: 2,
      isActive: true,
      status: MonitorStatus.UP,
      ownerId: "owner1"
    };

    prisma.monitor.findUnique.mockResolvedValue(monitor);

    prisma.checkResult.create.mockResolvedValue({
      id: "c1",
      status: CheckStatus.FAILURE
    });

    prisma.checkResult.findMany.mockResolvedValue([
      { status: CheckStatus.FAILURE },
      { status: CheckStatus.FAILURE }
    ]);

    prisma.incident.findFirst.mockResolvedValue(null);

    prisma.monitor.update.mockResolvedValue({
      ...monitor,
      status: MonitorStatus.DOWN
    });

    prisma.incident.create.mockResolvedValue({
      id: "i1",
      status: IncidentStatus.OPEN
    });

    jest.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("Connection failed")
    );

    const result = await service.runForMonitor("m1");

    expect(prisma.incident.create).toHaveBeenCalledTimes(1);
    expect(notifications.sendIncidentOpened).toHaveBeenCalledWith("i1");
    expect(result.incident?.id).toBe("i1");

    jest.restoreAllMocks();
  });
  
  it("should resolve active incident when monitor check succeeds", async () => {
    const monitor = {
      id: "m1",
      name: "Test Monitor",
      url: "https://example.com",
      method: "GET",
      expectedStatusCode: 200,
      timeoutSeconds: 5,
      failureThreshold: 2,
      isActive: true,
      status: MonitorStatus.DOWN,
      ownerId: "owner1"
    };

    const activeIncident = {
      id: "i1",
      monitorId: "m1",
      status: IncidentStatus.OPEN
    };

    prisma.monitor.findUnique.mockResolvedValue(monitor);

    prisma.checkResult.create.mockResolvedValue({
      id: "c2",
      status: CheckStatus.SUCCESS
    });

    prisma.checkResult.findMany.mockResolvedValue([
      { status: CheckStatus.SUCCESS }
    ]);

    prisma.incident.findFirst.mockResolvedValue(activeIncident);

    prisma.monitor.update.mockResolvedValue({
      ...monitor,
      status: MonitorStatus.UP
    });

    prisma.incident.update.mockResolvedValue({
      ...activeIncident,
      status: IncidentStatus.RESOLVED
    });

    jest.spyOn(global, "fetch").mockResolvedValue({
      status: 200
    } as Response);

    const result = await service.runForMonitor("m1");

    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { status: MonitorStatus.UP }
    });

    expect(prisma.incident.update).toHaveBeenCalledTimes(1);
    expect(notifications.sendIncidentResolved).toHaveBeenCalledWith("i1");
    expect(result.incident?.status).toBe(IncidentStatus.RESOLVED);

    jest.restoreAllMocks();
  });

  it("should not create duplicate incident when active incident exists", async () => {
    const monitor = {
      id: "m1",
      name: "Test Monitor",
      url: "https://example.com",
      method: "GET",
      expectedStatusCode: 200,
      timeoutSeconds: 5,
      failureThreshold: 2,
      isActive: true,
      status: MonitorStatus.DOWN,
      ownerId: "owner1"
    };

    const activeIncident = {
      id: "i1",
      monitorId: "m1",
      status: IncidentStatus.OPEN
    };

    prisma.monitor.findUnique.mockResolvedValue(monitor);

    prisma.checkResult.create.mockResolvedValue({
      id: "c3",
      status: CheckStatus.FAILURE
    });

    prisma.checkResult.findMany.mockResolvedValue([
      { status: CheckStatus.FAILURE },
      { status: CheckStatus.FAILURE }
    ]);

    prisma.incident.findFirst.mockResolvedValue(activeIncident);

    prisma.monitor.update.mockResolvedValue({
      ...monitor,
      status: MonitorStatus.DOWN
    });

    jest.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("Connection failed")
    );

    const result = await service.runForMonitor("m1");

    expect(prisma.incident.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.incident.create).not.toHaveBeenCalled();
    expect(notifications.sendIncidentOpened).not.toHaveBeenCalled();
    expect(result.incident?.id).toBe("i1");
    expect(result.incident?.status).toBe(IncidentStatus.OPEN);

    jest.restoreAllMocks();
  });

  it("should allow owner to access their monitor checks", async () => {
    const owner = { id: "user1", workspaceOwnerId: "owner1" };
    const monitor = { id: "m1", ownerId: "owner1" };

    prisma.monitor.findUnique.mockResolvedValue(monitor);
    prisma.checkResult.findMany.mockResolvedValue([]);

    const result = await service.listForMonitor(owner as any, "m1");

    expect(prisma.monitor.findUnique).toHaveBeenCalledWith({
      where: { id: "m1" }
    });
    expect(prisma.checkResult.findMany).toHaveBeenCalledWith({
      where: { monitorId: "m1" },
      orderBy: { checkedAt: "desc" },
      take: 50
    });
    expect(result).toEqual([]);
  });

  it("should throw ForbiddenException when another owner accesses monitor", async () => {
    const owner = { id: "user2", workspaceOwnerId: "owner2" };
    const monitor = { id: "m1", ownerId: "owner1" };

    prisma.monitor.findUnique.mockResolvedValue(monitor);

    await expect(
      service.listForMonitor(owner as any, "m1")
    ).rejects.toThrow("You do not have access to this monitor.");

    expect(prisma.checkResult.findMany).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException when monitor does not exist", async () => {
    const owner = { id: "user1", workspaceOwnerId: "owner1" };

    prisma.monitor.findUnique.mockResolvedValue(null);

    await expect(
      service.listForMonitor(owner as any, "unknown")
    ).rejects.toThrow("Monitor not found.");

    expect(prisma.checkResult.findMany).not.toHaveBeenCalled();
  });

  it("should calculate correct uptime and average response time", async () => {
    const owner = { id: "user1", workspaceOwnerId: "owner1" };
    const monitor = { id: "m1", ownerId: "owner1" };
    const now = new Date();

    prisma.monitor.findUnique.mockResolvedValue(monitor);
    prisma.checkResult.findMany.mockResolvedValue([
      {
        status: CheckStatus.SUCCESS,
        responseTimeMs: 100,
        checkedAt: new Date(now.getTime() - 1000)
      },
      {
        status: CheckStatus.SUCCESS,
        responseTimeMs: 200,
        checkedAt: new Date(now.getTime() - 2000)
      },
      {
        status: CheckStatus.FAILURE,
        responseTimeMs: 300,
        checkedAt: new Date(now.getTime() - 3000)
      },
      {
        status: CheckStatus.SUCCESS,
        responseTimeMs: 400,
        checkedAt: new Date(now.getTime() - 4000)
      }
    ]);

    const result = await service.getStatsForMonitor(owner as any, "m1");

    expect(result.last24h.totalChecks).toBe(4);
    expect(result.last24h.successfulChecks).toBe(3);
    expect(result.last24h.failedChecks).toBe(1);
    expect(result.last24h.uptimePercentage).toBe(75);
    expect(result.last24h.averageResponseTimeMs).toBe(250);
  });

  it("should handle empty check history correctly", async () => {
    const owner = { id: "user1", workspaceOwnerId: "owner1" };
    const monitor = { id: "m1", ownerId: "owner1" };

    prisma.monitor.findUnique.mockResolvedValue(monitor);
    prisma.checkResult.findMany.mockResolvedValue([]);

    const result = await service.getStatsForMonitor(owner as any, "m1");

    expect(result.last24h.totalChecks).toBe(0);
    expect(result.last24h.successfulChecks).toBe(0);
    expect(result.last24h.failedChecks).toBe(0);
    expect(result.last24h.uptimePercentage).toBeNull();
    expect(result.last24h.averageResponseTimeMs).toBeNull();
    expect(result.hourlyTimeline).toHaveLength(24);
  });
});