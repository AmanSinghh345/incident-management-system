import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MonitorStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { MonitorQueueService } from "../worker/monitor-queue.service";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  workspaceSlug: string;
}

interface CreateMonitorBody {
  name?: unknown;
  url?: unknown;
  intervalSeconds?: unknown;
  failureThreshold?: unknown;
}

interface UpdateMonitorBody {
  name?: unknown;
  url?: unknown;
  intervalSeconds?: unknown;
  failureThreshold?: unknown;
  isActive?: unknown;
}

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorQueueService: MonitorQueueService,
    private readonly realtimeService: RealtimeService
  ) {}

  async create(owner: AuthenticatedUser, body: CreateMonitorBody) {
    const name = this.readRequiredString(body.name, "name");
    const url = this.readUrl(body.url);
    const intervalSeconds = this.readInteger(body.intervalSeconds, "intervalSeconds", {
      defaultValue: 60,
      min: 30,
      max: 86400
    });
    const failureThreshold = this.readInteger(body.failureThreshold, "failureThreshold", {
      defaultValue: 3,
      min: 1,
      max: 10
    });

    const monitor = await this.prisma.monitor.create({
      data: {
        name,
        url,
        intervalSeconds,
        failureThreshold,
        status: MonitorStatus.UP,
        isActive: true,
        ownerId: owner.id
      }
    });

    await this.monitorQueueService.scheduleMonitor(monitor.id);
    this.realtimeService.emitMonitorChanged(owner.id, monitor);

    return monitor;
  }

  list(owner: AuthenticatedUser) {
    return this.prisma.monitor.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: "desc" },
      include: {
        checkResults: {
          orderBy: { checkedAt: "desc" },
          take: 1
        },
        incidents: {
          where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          orderBy: { startedAt: "desc" },
          take: 1
        }
      }
    });
  }

  async getForOwner(owner: AuthenticatedUser, monitorId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
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

    if (!monitor) {
      throw new NotFoundException("Monitor not found.");
    }

    if (monitor.ownerId !== owner.id) {
      throw new ForbiddenException("You do not have access to this monitor.");
    }

    return monitor;
  }

  async update(owner: AuthenticatedUser, monitorId: string, body: UpdateMonitorBody) {
    await this.getForOwner(owner, monitorId);
    const data: {
      name?: string;
      url?: string;
      intervalSeconds?: number;
      failureThreshold?: number;
      isActive?: boolean;
      status?: MonitorStatus;
    } = {};

    if (body.name !== undefined) {
      data.name = this.readRequiredString(body.name, "name");
    }

    if (body.url !== undefined) {
      data.url = this.readUrl(body.url);
    }

    if (body.intervalSeconds !== undefined) {
      data.intervalSeconds = this.readInteger(body.intervalSeconds, "intervalSeconds", {
        min: 30,
        max: 86400
      });
    }

    if (body.failureThreshold !== undefined) {
      data.failureThreshold = this.readInteger(body.failureThreshold, "failureThreshold", {
        min: 1,
        max: 10
      });
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        throw new BadRequestException("isActive must be a boolean.");
      }

      data.isActive = body.isActive;
      data.status = body.isActive ? MonitorStatus.UP : MonitorStatus.PAUSED;
    }

    const monitor = await this.prisma.monitor.update({
      where: { id: monitorId },
      data
    });

    if (monitor.isActive) {
      await this.monitorQueueService.scheduleMonitor(monitor.id);
    } else {
      await this.monitorQueueService.removeScheduledMonitor(monitor.id);
    }

    this.realtimeService.emitMonitorChanged(owner.id, monitor);

    return monitor;
  }

  async delete(owner: AuthenticatedUser, monitorId: string) {
    await this.getForOwner(owner, monitorId);
    await this.monitorQueueService.removeScheduledMonitor(monitorId);
    await this.prisma.monitor.delete({ where: { id: monitorId } });
    this.realtimeService.emitMonitorDeleted(owner.id, monitorId);

    return { deleted: true };
  }

  private readRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private readUrl(value: unknown) {
    const url = this.readRequiredString(value, "url");

    try {
      const parsed = new URL(url);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol.");
      }

      return parsed.toString();
    } catch {
      throw new BadRequestException("url must be a valid http or https URL.");
    }
  }

  private readInteger(
    value: unknown,
    field: string,
    options: { defaultValue?: number; min: number; max: number }
  ) {
    if (value === undefined || value === null) {
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }

      throw new BadRequestException(`${field} is required.`);
    }

    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new BadRequestException(`${field} must be an integer.`);
    }

    if (value < options.min || value > options.max) {
      throw new BadRequestException(
        `${field} must be between ${options.min} and ${options.max}.`
      );
    }

    return value;
  }
}
