import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MonitorStatus, WorkspaceRole } from "@prisma/client";
import { AuditLogService } from "../audit/audit-log.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { MonitorQueueService } from "../worker/monitor-queue.service";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  workspaceSlug: string;
  workspaceOwnerId: string;
  workspaceRole: WorkspaceRole;
}

interface CreateMonitorBody {
  name?: unknown;
  url?: unknown;
  method?: unknown;
  expectedStatusCode?: unknown;
  timeoutSeconds?: unknown;
  isPublic?: unknown;
  publicName?: unknown;
  showUrl?: unknown;
  intervalSeconds?: unknown;
  failureThreshold?: unknown;
}

interface UpdateMonitorBody {
  name?: unknown;
  url?: unknown;
  method?: unknown;
  expectedStatusCode?: unknown;
  timeoutSeconds?: unknown;
  isPublic?: unknown;
  publicName?: unknown;
  showUrl?: unknown;
  intervalSeconds?: unknown;
  failureThreshold?: unknown;
  isActive?: unknown;
}

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorQueueService: MonitorQueueService,
    private readonly realtimeService: RealtimeService,
    private readonly auditLogService: AuditLogService
  ) {}

  async create(owner: AuthenticatedUser, body: CreateMonitorBody) {
    const name = this.readRequiredString(body.name, "name");
    const url = this.readUrl(body.url);
    const method = this.readMethod(body.method, "GET");
    const expectedStatusCode = this.readInteger(
      body.expectedStatusCode,
      "expectedStatusCode",
      {
        defaultValue: 200,
        min: 100,
        max: 599
      }
    );
    const timeoutSeconds = this.readInteger(body.timeoutSeconds, "timeoutSeconds", {
      defaultValue: 5,
      min: 1,
      max: 60
    });
    const isPublic = this.readBoolean(body.isPublic, "isPublic", true);
    const publicName = this.readOptionalString(body.publicName, "publicName");
    const showUrl = this.readBoolean(body.showUrl, "showUrl", false);
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
        method,
        expectedStatusCode,
        timeoutSeconds,
        isPublic,
        publicName,
        showUrl,
        intervalSeconds,
        failureThreshold,
        status: MonitorStatus.UP,
        isActive: true,
        ownerId: this.requireWorkspaceManager(owner)
      }
    });

    await this.monitorQueueService.scheduleMonitor(monitor.id);
    await this.auditLogService.record(owner, {
      action: "monitor.created",
      entityType: "monitor",
      entityId: monitor.id,
      summary: `Created monitor ${monitor.name}.`,
      metadata: {
        url: monitor.url,
        method: monitor.method,
        intervalSeconds: monitor.intervalSeconds
      }
    });
    this.realtimeService.emitMonitorChanged(owner.workspaceOwnerId, monitor);

    return monitor;
  }

  list(owner: AuthenticatedUser) {
    return this.prisma.monitor.findMany({
      where: { ownerId: owner.workspaceOwnerId },
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

    if (monitor.ownerId !== owner.workspaceOwnerId) {
      throw new ForbiddenException("You do not have access to this monitor.");
    }

    return monitor;
  }

  async update(owner: AuthenticatedUser, monitorId: string, body: UpdateMonitorBody) {
    await this.getForOwner(owner, monitorId);
    this.requireWorkspaceManager(owner);
    const data: {
      name?: string;
      url?: string;
      method?: string;
      expectedStatusCode?: number;
      timeoutSeconds?: number;
      isPublic?: boolean;
      publicName?: string | null;
      showUrl?: boolean;
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

    if (body.method !== undefined) {
      data.method = this.readMethod(body.method);
    }

    if (body.expectedStatusCode !== undefined) {
      data.expectedStatusCode = this.readInteger(
        body.expectedStatusCode,
        "expectedStatusCode",
        {
          min: 100,
          max: 599
        }
      );
    }

    if (body.timeoutSeconds !== undefined) {
      data.timeoutSeconds = this.readInteger(body.timeoutSeconds, "timeoutSeconds", {
        min: 1,
        max: 60
      });
    }

    if (body.isPublic !== undefined) {
      data.isPublic = this.readBoolean(body.isPublic, "isPublic");
    }

    if (body.publicName !== undefined) {
      data.publicName = this.readOptionalString(body.publicName, "publicName");
    }

    if (body.showUrl !== undefined) {
      data.showUrl = this.readBoolean(body.showUrl, "showUrl");
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

    await this.auditLogService.record(owner, {
      action: "monitor.updated",
      entityType: "monitor",
      entityId: monitor.id,
      summary: `Updated monitor ${monitor.name}.`,
      metadata: data
    });
    this.realtimeService.emitMonitorChanged(owner.workspaceOwnerId, monitor);

    return monitor;
  }

  async delete(owner: AuthenticatedUser, monitorId: string) {
    await this.getForOwner(owner, monitorId);
    this.requireWorkspaceManager(owner);
    await this.monitorQueueService.removeScheduledMonitor(monitorId);
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { name: true, url: true }
    });
    await this.prisma.monitor.delete({ where: { id: monitorId } });
    await this.auditLogService.record(owner, {
      action: "monitor.deleted",
      entityType: "monitor",
      entityId: monitorId,
      summary: `Deleted monitor ${monitor?.name ?? monitorId}.`,
      metadata: {
        url: monitor?.url
      }
    });
    this.realtimeService.emitMonitorDeleted(owner.workspaceOwnerId, monitorId);

    return { deleted: true };
  }

  private readRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private requireWorkspaceManager(owner: AuthenticatedUser) {
    if (
      owner.workspaceRole !== WorkspaceRole.OWNER &&
      owner.workspaceRole !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to manage monitors.");
    }

    return owner.workspaceOwnerId;
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

  private readMethod(value: unknown, defaultValue?: string) {
    if (value === undefined || value === null) {
      if (defaultValue) {
        return defaultValue;
      }

      throw new BadRequestException("method is required.");
    }

    if (typeof value !== "string") {
      throw new BadRequestException("method must be a string.");
    }

    const method = value.trim().toUpperCase();

    if (!["GET", "POST", "HEAD"].includes(method)) {
      throw new BadRequestException("method must be GET, POST, or HEAD.");
    }

    return method;
  }

  private readBoolean(value: unknown, field: string, defaultValue?: boolean) {
    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      throw new BadRequestException(`${field} is required.`);
    }

    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean.`);
    }

    return value;
  }

  private readOptionalString(value: unknown, field: string) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`${field} must be a string.`);
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
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
