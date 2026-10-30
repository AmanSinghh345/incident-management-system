
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CheckStatus, IncidentStatus, MonitorStatus } from "@prisma/client";
import { StatusService } from "./status.service";
import { PrismaService } from "../prisma/prisma.service";

describe("StatusService", () => {
  let service: StatusService;
  let prisma: {
    user: { findUnique: jest.Mock };
    incident: { findMany: jest.Mock };
  };

  const now = new Date();
  const recentCheck = {
    status: CheckStatus.SUCCESS,
    responseTimeMs: 120,
    checkedAt: new Date(now.getTime() - 60 * 60 * 1000)
  };

  const createMonitor = (overrides: any = {}) => ({
    id: "monitor-1",
    name: "Production API",
    publicName: "Public API",
    url: "https://api.example.com",
    showUrl: true,
    status: MonitorStatus.UP,
    isActive: true,
    checkResults: [recentCheck],
    incidents: [],
    ...overrides
  });

  const createOwner = (monitors: any[] = []) => ({
    id: "owner-1",
    name: "Test Workspace",
    workspaceSlug: "test-workspace",
    monitors
  });

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      incident: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const module = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get(StatusService);
  });

  it("should throw NotFoundException when the workspace does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getPublicStatus("missing-workspace"))
      .rejects.toThrow(NotFoundException);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceSlug: "missing-workspace" }
      })
    );

    expect(prisma.incident.findMany).not.toHaveBeenCalled();
  });

  it("should return the public status page with monitor and uptime details", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([createMonitor()])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.workspace).toEqual({
      name: "Test Workspace",
      slug: "test-workspace"
    });

    expect(result.summary).toEqual({
      status: "OPERATIONAL",
      totalMonitors: 1,
      activeMonitors: 1,
      openIncidents: 0
    });

    expect(result.monitors).toHaveLength(1);
    expect(result.monitors[0]).toMatchObject({
      id: "monitor-1",
      name: "Public API",
      url: "https://api.example.com",
      status: MonitorStatus.UP,
      isActive: true,
      latestCheck: recentCheck,
      uptime: {
        last24h: {
          totalChecks: 1,
          uptimePercentage: 100,
          averageResponseTimeMs: 120
        },
        last7d: {
          totalChecks: 1,
          uptimePercentage: 100,
          averageResponseTimeMs: 120
        }
      },
      activeIncident: null
    });

    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(prisma.incident.findMany).toHaveBeenCalledTimes(1);
  });

  it("should hide monitor URLs and use the original name when publicName is null", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor({
          name: "Internal API",
          publicName: null,
          showUrl: false
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.monitors[0].name).toBe("Internal API");
    expect(result.monitors[0].url).toBeNull();
  });

  it("should exclude inactive monitors from the overall status calculation", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor(),
        createMonitor({
          id: "monitor-2",
          isActive: false,
          status: MonitorStatus.DOWN
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary).toEqual({
      status: "OPERATIONAL",
      totalMonitors: 2,
      activeMonitors: 1,
      openIncidents: 0
    });
  });

  it("should return NO_MONITORS when the workspace has no public monitors", async () => {
    prisma.user.findUnique.mockResolvedValue(createOwner([]));

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary.status).toBe("NO_MONITORS");
    expect(result.summary.totalMonitors).toBe(0);
    expect(result.summary.activeMonitors).toBe(0);
  });

  it("should return MAJOR_OUTAGE when an active monitor is down", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor({ status: MonitorStatus.DOWN }),
        createMonitor({
          id: "monitor-2",
          status: MonitorStatus.DEGRADED
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary.status).toBe("MAJOR_OUTAGE");
  });

  it("should return PARTIAL_OUTAGE when a monitor is degraded but none are down", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor(),
        createMonitor({
          id: "monitor-2",
          status: MonitorStatus.DEGRADED
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary.status).toBe("PARTIAL_OUTAGE");
  });

  it("should return PAUSED when all active monitors are paused", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor({ status: MonitorStatus.PAUSED }),
        createMonitor({
          id: "monitor-2",
          status: MonitorStatus.PAUSED
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary.status).toBe("PAUSED");
  });

  it("should calculate uptime and average response time correctly", async () => {
    const checks = [
      {
        status: CheckStatus.SUCCESS,
        responseTimeMs: 100,
        checkedAt: new Date()
      },
      {
        status: "FAILED" as CheckStatus,
        responseTimeMs: 200,
        checkedAt: new Date()
      },
      {
        status: CheckStatus.SUCCESS,
        responseTimeMs: null,
        checkedAt: new Date()
      }
    ];

    prisma.user.findUnique.mockResolvedValue(
      createOwner([createMonitor({ checkResults: checks })])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.monitors[0].uptime.last7d).toEqual({
      totalChecks: 3,
      uptimePercentage: 66.67,
      averageResponseTimeMs: 150
    });
  });

  it("should return null uptime and response time when there are no checks", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([createMonitor({ checkResults: [] })])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.monitors[0].latestCheck).toBeNull();
    expect(result.monitors[0].uptime.last24h).toEqual({
      totalChecks: 0,
      uptimePercentage: null,
      averageResponseTimeMs: null
    });
  });

  it("should include active incidents and map their monitor details", async () => {
    const incident = {
      id: "incident-1",
      status: IncidentStatus.OPEN,
      updates: [{ id: "update-1" }]
    };

    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor({
          incidents: [incident]
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.summary.openIncidents).toBe(1);
    expect(result.incidents[0]).toMatchObject({
      id: "incident-1",
      monitor: {
        id: "monitor-1",
        name: "Public API",
        url: "https://api.example.com",
        status: MonitorStatus.UP
      }
    });
  });

  it("should hide the URL in active incident monitor details when showUrl is false", async () => {
    prisma.user.findUnique.mockResolvedValue(
      createOwner([
        createMonitor({
          showUrl: false,
          incidents: [{ id: "incident-1" }]
        })
      ])
    );

    const result = await service.getPublicStatus("test-workspace");

    expect(result.incidents[0].monitor.url).toBeNull();
  });

  it("should map recent incidents and hide their monitor URLs when required", async () => {
    prisma.user.findUnique.mockResolvedValue(createOwner([]));

    prisma.incident.findMany.mockResolvedValue([
      {
        id: "incident-2",
        monitor: {
          id: "monitor-2",
          name: "Internal API",
          publicName: "Public Internal API",
          url: "https://internal.example.com",
          showUrl: false,
          status: MonitorStatus.DOWN
        },
        updates: []
      }
    ]);

    const result = await service.getPublicStatus("test-workspace");

    expect(result.recentIncidents[0].monitor).toEqual({
      id: "monitor-2",
      name: "Public Internal API",
      url: null,
      status: MonitorStatus.DOWN
    });
  });

  it("should limit recent incidents to 10 and order them by start time", async () => {
    prisma.user.findUnique.mockResolvedValue(createOwner([]));

    await service.getPublicStatus("test-workspace");

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          monitor: {
            ownerId: "owner-1",
            isPublic: true
          }
        },
        orderBy: { startedAt: "desc" },
        take: 10
      })
    );
  });
});
