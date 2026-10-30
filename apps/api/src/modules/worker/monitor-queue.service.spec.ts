import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import { MonitorQueueService } from "./monitor-queue.service";

jest.mock("bullmq", () => ({
  Queue: jest.fn(),
  Worker: jest.fn()
}));

describe("MonitorQueueService", () => {
  let service: MonitorQueueService;

  const config = {
    get: jest.fn()
  };

  const checks = {
    runForMonitor: jest.fn()
  };

  const prisma = {
    monitor: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    }
  };

  const queue = {
    add: jest.fn(),
    getDelayed: jest.fn(),
    close: jest.fn()
  };

  const worker = {
    close: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MonitorQueueService(
      config as unknown as ConfigService,
      checks as any,
      prisma as any
    );

    // Inject mocked BullMQ objects without connecting to Redis.
    (service as any).queue = queue;
    (service as any).worker = worker;
  });

  describe("scheduleMonitor", () => {
    it("should schedule an active monitor using its configured interval", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        intervalSeconds: 60,
        isActive: true
      });

      queue.getDelayed.mockResolvedValue([]);

      await service.scheduleMonitor("monitor-1");

      expect(prisma.monitor.findUnique).toHaveBeenCalledWith({
        where: { id: "monitor-1" },
        select: {
          id: true,
          intervalSeconds: true,
          isActive: true
        }
      });

      expect(queue.add).toHaveBeenCalledWith(
        "check-monitor",
        { monitorId: "monitor-1" },
        expect.objectContaining({
          delay: 60000,
          jobId: expect.stringContaining("check-monitor-monitor-1"),
          removeOnComplete: true,
          removeOnFail: 100
        })
      );
    });

    it("should use a custom delay when provided", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        intervalSeconds: 60,
        isActive: true
      });

      queue.getDelayed.mockResolvedValue([]);

      await service.scheduleMonitor("monitor-1", 5);

      expect(queue.add).toHaveBeenCalledWith(
        "check-monitor",
        { monitorId: "monitor-1" },
        expect.objectContaining({
          delay: 5000
        })
      );
    });

    it("should not schedule a monitor that does not exist", async () => {
      prisma.monitor.findUnique.mockResolvedValue(null);

      await service.scheduleMonitor("invalid-monitor");

      expect(queue.add).not.toHaveBeenCalled();
    });

    it("should not schedule an inactive monitor", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        intervalSeconds: 60,
        isActive: false
      });

      await service.scheduleMonitor("monitor-1");

      expect(queue.add).not.toHaveBeenCalled();
    });

    it("should not schedule when the queue is unavailable", async () => {
      (service as any).queue = undefined;

      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        intervalSeconds: 60,
        isActive: true
      });

      await service.scheduleMonitor("monitor-1");

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe("removeScheduledMonitor", () => {
    it("should remove delayed jobs belonging to the monitor", async () => {
      const job1 = {
        id: "job-1",
        name: "check-monitor",
        data: { monitorId: "monitor-1" },
        remove: jest.fn()
      };

      const job2 = {
        id: "job-2",
        name: "check-monitor",
        data: { monitorId: "monitor-2" },
        remove: jest.fn()
      };

      queue.getDelayed.mockResolvedValue([job1, job2]);

      await service.removeScheduledMonitor("monitor-1");

      expect(job1.remove).toHaveBeenCalled();
      expect(job2.remove).not.toHaveBeenCalled();
    });

    it("should handle errors while removing a delayed job", async () => {
      const job = {
        id: "job-1",
        name: "check-monitor",
        data: { monitorId: "monitor-1" },
        remove: jest.fn().mockRejectedValue(new Error("Redis error"))
      };

      queue.getDelayed.mockResolvedValue([job]);

      await expect(
        service.removeScheduledMonitor("monitor-1")
      ).resolves.toBeUndefined();

      expect(job.remove).toHaveBeenCalled();
    });

    it("should safely handle an unavailable queue", async () => {
      (service as any).queue = undefined;

      await expect(
        service.removeScheduledMonitor("monitor-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("processCheckJob", () => {
    it("should run a check and schedule the next check", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        isActive: true,
        intervalSeconds: 60
      });

      const scheduleSpy = jest
        .spyOn(service, "scheduleMonitor")
        .mockResolvedValue(undefined);

      await (service as any).processCheckJob({
        data: { monitorId: "monitor-1" }
      });

      expect(checks.runForMonitor).toHaveBeenCalledWith("monitor-1");
      expect(scheduleSpy).toHaveBeenCalledWith("monitor-1");
    });

    it("should not run a check for an inactive monitor", async () => {
      prisma.monitor.findUnique.mockResolvedValue({
        id: "monitor-1",
        isActive: false,
        intervalSeconds: 60
      });

      await (service as any).processCheckJob({
        data: { monitorId: "monitor-1" }
      });

      expect(checks.runForMonitor).not.toHaveBeenCalled();
    });

    it("should not run a check when the monitor does not exist", async () => {
      prisma.monitor.findUnique.mockResolvedValue(null);

      await (service as any).processCheckJob({
        data: { monitorId: "monitor-1" }
      });

      expect(checks.runForMonitor).not.toHaveBeenCalled();
    });
  });

  describe("scheduleExistingActiveMonitors", () => {
    it("should schedule all active monitors on startup", async () => {
      prisma.monitor.findMany.mockResolvedValue([
        { id: "monitor-1" },
        { id: "monitor-2" }
      ]);

      const scheduleSpy = jest
        .spyOn(service, "scheduleMonitor")
        .mockResolvedValue(undefined);

      await (service as any).scheduleExistingActiveMonitors();

      expect(prisma.monitor.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true }
      });

      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(scheduleSpy).toHaveBeenNthCalledWith(1, "monitor-1", 5);
      expect(scheduleSpy).toHaveBeenNthCalledWith(2, "monitor-2", 5);
    });

    it("should handle an empty list of active monitors", async () => {
      prisma.monitor.findMany.mockResolvedValue([]);

      const scheduleSpy = jest.spyOn(service, "scheduleMonitor");

      await (service as any).scheduleExistingActiveMonitors();

      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("should continue when scheduling one monitor fails", async () => {
      prisma.monitor.findMany.mockResolvedValue([
        { id: "monitor-1" },
        { id: "monitor-2" }
      ]);

      const scheduleSpy = jest
        .spyOn(service, "scheduleMonitor")
        .mockRejectedValueOnce(new Error("Queue error"))
        .mockResolvedValueOnce(undefined);

      await expect(
        (service as any).scheduleExistingActiveMonitors()
      ).resolves.toBeUndefined();

      expect(scheduleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("onModuleDestroy", () => {
    it("should close the worker and queue", async () => {
      await service.onModuleDestroy();

      expect(worker.close).toHaveBeenCalled();
      expect(queue.close).toHaveBeenCalled();
    });
  });

  describe("createRedisConnection", () => {
    it("should create a Redis connection from REDIS_URL", () => {
      config.get.mockImplementation((key: string) => {
        if (key === "REDIS_URL") {
          return "redis://user%40name:p%40ss@example.com:6380";
        }
        return undefined;
      });

      const connection = (service as any).createRedisConnection();

      expect(connection).toEqual(
        expect.objectContaining({
          host: "example.com",
          port: 6380,
          username: "user@name",
          password: "p@ss",
          maxRetriesPerRequest: null
        })
      );
    });

    it("should enable TLS for a rediss URL", () => {
      config.get.mockImplementation((key: string) => {
        if (key === "REDIS_URL") {
          return "rediss://example.com:6380";
        }
        return undefined;
      });

      const connection = (service as any).createRedisConnection();

      expect(connection).toEqual(
        expect.objectContaining({
          host: "example.com",
          port: 6380,
          tls: {},
          maxRetriesPerRequest: null
        })
      );
    });

    it("should use default Redis settings when REDIS_URL is absent", () => {
      config.get.mockReturnValue(undefined);

      const connection = (service as any).createRedisConnection();

      expect(connection).toEqual({
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null
      });
    });

    it("should use REDIS_HOST and REDIS_PORT when REDIS_URL is absent", () => {
      config.get.mockImplementation((key: string) => {
        const values: Record<string, string> = {
          REDIS_HOST: "redis.example.com",
          REDIS_PORT: "6381"
        };
        return values[key];
      });

      const connection = (service as any).createRedisConnection();

      expect(connection).toEqual({
        host: "redis.example.com",
        port: 6381,
        maxRetriesPerRequest: null
      });
    });
  });

  describe("onModuleInit", () => {
    it("should initialize the queue and worker and schedule existing monitors", async () => {
      config.get.mockReturnValue(undefined);

      const queueInstance = {
        add: jest.fn(),
        getDelayed: jest.fn(),
        close: jest.fn()
      };
      const workerInstance = {
        on: jest.fn(),
        close: jest.fn()
      };

      (Queue as unknown as jest.Mock).mockImplementation(() => queueInstance);
      (Worker as unknown as jest.Mock).mockImplementation(() => workerInstance);

      prisma.monitor.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(Queue).toHaveBeenCalledWith(
        "monitor-checks",
        expect.objectContaining({
          connection: expect.objectContaining({
            host: "localhost",
            port: 6379
          })
        })
      );

      expect(Worker).toHaveBeenCalledWith(
        "monitor-checks",
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            host: "localhost",
            port: 6379
          })
        })
      );

      expect(workerInstance.on).toHaveBeenCalledWith(
        "failed",
        expect.any(Function)
      );
      expect(prisma.monitor.findMany).toHaveBeenCalled();
    });
  });
});