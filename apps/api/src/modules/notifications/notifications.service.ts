import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationChannel, NotificationStatus, WorkspaceRole } from "@prisma/client";
import { createHmac, randomBytes } from "crypto";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { PrismaService } from "../prisma/prisma.service";

interface WebhookBody {
  name?: unknown;
  url?: unknown;
  isActive?: unknown;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService
  ) {}

  listWebhooks(owner: AuthenticatedUser) {
    return this.prisma.webhookEndpoint.findMany({
      where: { userId: owner.workspaceOwnerId },
      orderBy: { createdAt: "desc" }
    });
  }

  listHistory(owner: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: { userId: owner.workspaceOwnerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        incident: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });
  }

  async createWebhook(owner: AuthenticatedUser, body: WebhookBody) {
    this.requireWorkspaceManager(owner);
    const name = this.readRequiredString(body.name, "name");
    const url = this.readWebhookUrl(body.url);

    const webhook = await this.prisma.webhookEndpoint.create({
      data: {
        name,
        url,
        secret: this.generateWebhookSecret(),
        userId: owner.workspaceOwnerId
      }
    });

    await this.auditLogService.record(owner, {
      action: "webhook.created",
      entityType: "webhook",
      entityId: webhook.id,
      summary: `Created webhook ${webhook.name}.`,
      metadata: { url: webhook.url }
    });

    return webhook;
  }

  async updateWebhook(
    owner: AuthenticatedUser,
    webhookId: string,
    body: WebhookBody
  ) {
    this.requireWorkspaceManager(owner);
    await this.assertWebhookOwner(owner, webhookId);
    const data: { name?: string; url?: string; isActive?: boolean } = {};

    if (body.name !== undefined) {
      data.name = this.readRequiredString(body.name, "name");
    }

    if (body.url !== undefined) {
      data.url = this.readWebhookUrl(body.url);
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        throw new BadRequestException("isActive must be a boolean.");
      }

      data.isActive = body.isActive;
    }

    const webhook = await this.prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data
    });

    await this.auditLogService.record(owner, {
      action: "webhook.updated",
      entityType: "webhook",
      entityId: webhook.id,
      summary: `Updated webhook ${webhook.name}.`,
      metadata: data
    });

    return webhook;
  }

  async deleteWebhook(owner: AuthenticatedUser, webhookId: string) {
    this.requireWorkspaceManager(owner);
    const webhook = await this.assertWebhookOwner(owner, webhookId);
    await this.prisma.webhookEndpoint.delete({ where: { id: webhookId } });
    await this.auditLogService.record(owner, {
      action: "webhook.deleted",
      entityType: "webhook",
      entityId: webhookId,
      summary: `Deleted webhook ${webhook.name}.`,
      metadata: { url: webhook.url }
    });

    return { deleted: true };
  }

  async rotateWebhookSecret(owner: AuthenticatedUser, webhookId: string) {
    this.requireWorkspaceManager(owner);
    await this.assertWebhookOwner(owner, webhookId);

    const webhook = await this.prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        secret: this.generateWebhookSecret()
      }
    });

    await this.auditLogService.record(owner, {
      action: "webhook.secret_rotated",
      entityType: "webhook",
      entityId: webhook.id,
      summary: `Rotated secret for webhook ${webhook.name}.`
    });

    return webhook;
  }

  async testWebhook(owner: AuthenticatedUser, webhookId: string) {
    const webhook = await this.assertWebhookOwner(owner, webhookId);

    if (!webhook.isActive) {
      throw new BadRequestException("Webhook is paused.");
    }

    const result = await this.deliverWebhook(
      webhook.url,
      webhook.secret,
      "webhook.test",
      {
        event: "webhook.test",
        workspaceSlug: owner.workspaceSlug,
        message: "PulseOps test webhook.",
        sentAt: new Date()
      }
    );

    const notification = await this.prisma.notification.create({
      data: {
        channel: NotificationChannel.WEBHOOK,
        status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
        recipient: webhook.url,
        subject: "webhook.test",
        message: result.message,
        userId: owner.workspaceOwnerId,
        sentAt: result.ok ? new Date() : undefined
      }
    });

    await this.auditLogService.record(owner, {
      action: "notification.webhook_tested",
      entityType: "webhook",
      entityId: webhook.id,
      summary: `Sent test webhook to ${webhook.name}.`,
      metadata: { status: notification.status }
    });

    return notification;
  }

  async testEmail(owner: AuthenticatedUser) {
    const result = await this.deliverResendEmail({
      to: owner.email,
      subject: "PulseOps test email",
      html: this.renderEmailTemplate({
        title: "PulseOps test email",
        eyebrow: "EMAIL TEST",
        body: "Your PulseOps email notification channel is connected.",
        details: [
          ["Workspace", owner.workspaceSlug],
          ["Recipient", owner.email]
        ]
      }),
      text: `PulseOps test email\nWorkspace: ${owner.workspaceSlug}\nRecipient: ${owner.email}`
    });

    const notification = await this.prisma.notification.create({
      data: {
        channel: NotificationChannel.EMAIL,
        status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
        recipient: owner.email,
        subject: "email.test",
        message: result.message,
        userId: owner.workspaceOwnerId,
        sentAt: result.ok ? new Date() : undefined
      }
    });

    await this.auditLogService.record(owner, {
      action: "notification.email_tested",
      entityType: "notification",
      entityId: notification.id,
      summary: `Sent test email to ${owner.email}.`,
      metadata: { status: notification.status }
    });

    return notification;
  }

  async sendIncidentOpened(incidentId: string) {
    await this.sendIncidentNotification(incidentId, "incident.opened");
  }

  async sendIncidentResolved(incidentId: string) {
    await this.sendIncidentNotification(incidentId, "incident.resolved");
  }

  private async sendIncidentNotification(
    incidentId: string,
    eventType: "incident.opened" | "incident.resolved"
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        monitor: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
                workspaceSlug: true
              }
            }
          }
        },
        updates: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!incident) {
      return;
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        userId: incident.monitor.ownerId,
        isActive: true
      }
    });

    await Promise.all(
      endpoints.map((endpoint) =>
        this.deliverWebhook(
          endpoint.url,
          endpoint.secret,
          eventType,
          {
            event: eventType,
            workspaceSlug: incident.monitor.owner.workspaceSlug,
            incident: {
              id: incident.id,
              title: incident.title,
              status: incident.status,
              severity: incident.severity,
              startedAt: incident.startedAt,
              resolvedAt: incident.resolvedAt
            },
            monitor: {
              id: incident.monitor.id,
              name: incident.monitor.name,
              url: incident.monitor.url,
              status: incident.monitor.status
            },
            latestUpdate: incident.updates[0] ?? null
          }
        ).then((result) =>
          this.prisma.notification.create({
            data: {
              channel: NotificationChannel.WEBHOOK,
              status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
              recipient: endpoint.url,
              subject: `${eventType}: ${incident.title}`,
              message: result.message,
              userId: incident.monitor.ownerId,
              incidentId: incident.id,
              sentAt: result.ok ? new Date() : undefined
            }
          })
        )
      )
    );

    const emailResult = await this.deliverResendEmail({
      to: incident.monitor.owner.email,
      subject: this.incidentEmailSubject(eventType, incident.title),
      html: this.renderIncidentEmail(eventType, incident),
      text: this.renderIncidentEmailText(eventType, incident)
    });

    await this.prisma.notification.create({
      data: {
        channel: NotificationChannel.EMAIL,
        status: emailResult.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
        recipient: incident.monitor.owner.email,
        subject: this.incidentEmailSubject(eventType, incident.title),
        message: emailResult.message,
        userId: incident.monitor.ownerId,
        incidentId: incident.id,
        sentAt: emailResult.ok ? new Date() : undefined
      }
    });
  }

  private async deliverWebhook(
    url: string,
    secret: string,
    eventType: string,
    payload: object
  ) {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = this.signWebhookPayload(secret, timestamp, body);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PulseOps-Webhook/0.1",
          "X-PulseOps-Event": eventType,
          "X-PulseOps-Timestamp": timestamp,
          "X-PulseOps-Signature": signature
        },
        body,
        signal: AbortSignal.timeout(5000)
      });

      return {
        ok: response.ok,
        message: response.ok
          ? `Webhook delivered with status ${response.status}.`
          : `Webhook failed with status ${response.status}.`
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Webhook request failed."
      };
    }
  }

  private generateWebhookSecret() {
    return `whsec_${randomBytes(32).toString("hex")}`;
  }

  private signWebhookPayload(secret: string, timestamp: string, body: string) {
    return createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }

  private async deliverResendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY")?.trim();
    const from = this.configService.get<string>("RESEND_FROM")?.trim();

    if (!apiKey) {
      const message = "Resend email is not configured. Set RESEND_API_KEY.";
      this.logger.warn(message);

      return {
        ok: false,
        message
      };
    }

    if (!from) {
      const message = "Resend email sender is not configured. Set RESEND_FROM.";
      this.logger.warn(message);

      return {
        ok: false,
        message
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;
      const message = response.ok
        ? `Email sent via Resend${data?.id ? ` (${data.id})` : ""}.`
        : `Resend email failed with status ${response.status}${
            data?.message ? `: ${data.message}` : ""
          }.`;

      if (!response.ok) {
        this.logger.error(message);
      }

      return {
        ok: response.ok,
        message
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Resend email request failed.";
      this.logger.error(`Resend email request failed: ${message}`);

      return {
        ok: false,
        message
      };
    }
  }

  private incidentEmailSubject(
    eventType: "incident.opened" | "incident.resolved",
    title: string
  ) {
    return eventType === "incident.opened"
      ? `[PulseOps] Incident opened: ${title}`
      : `[PulseOps] Incident resolved: ${title}`;
  }

  private renderIncidentEmail(
    eventType: "incident.opened" | "incident.resolved",
    incident: {
      title: string;
      status: string;
      severity: string;
      startedAt: Date;
      resolvedAt: Date | null;
      monitor: { name: string; url: string; status: string };
      updates: { message: string }[];
    }
  ) {
    return this.renderEmailTemplate({
      title: incident.title,
      eyebrow: eventType === "incident.opened" ? "INCIDENT OPENED" : "INCIDENT RESOLVED",
      body:
        incident.updates[0]?.message ??
        (eventType === "incident.opened"
          ? "A monitor check has opened an incident."
          : "The incident has been resolved."),
      details: [
        ["Monitor", incident.monitor.name],
        ["URL", incident.monitor.url],
        ["Monitor status", incident.monitor.status],
        ["Incident status", incident.status],
        ["Severity", incident.severity],
        ["Started", incident.startedAt.toISOString()],
        ["Resolved", incident.resolvedAt?.toISOString() ?? "Not resolved"]
      ]
    });
  }

  private renderIncidentEmailText(
    eventType: "incident.opened" | "incident.resolved",
    incident: {
      title: string;
      status: string;
      severity: string;
      startedAt: Date;
      resolvedAt: Date | null;
      monitor: { name: string; url: string; status: string };
      updates: { message: string }[];
    }
  ) {
    return [
      eventType === "incident.opened" ? "INCIDENT OPENED" : "INCIDENT RESOLVED",
      incident.title,
      "",
      incident.updates[0]?.message ?? "",
      "",
      `Monitor: ${incident.monitor.name}`,
      `URL: ${incident.monitor.url}`,
      `Monitor status: ${incident.monitor.status}`,
      `Incident status: ${incident.status}`,
      `Severity: ${incident.severity}`,
      `Started: ${incident.startedAt.toISOString()}`,
      `Resolved: ${incident.resolvedAt?.toISOString() ?? "Not resolved"}`
    ].join("\n");
  }

  private renderEmailTemplate(input: {
    eyebrow: string;
    title: string;
    body: string;
    details: [string, string][];
  }) {
    const detailRows = input.details
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px;color:#64748b;">${this.escapeHtml(
            label
          )}</td><td style="padding:8px 12px;color:#0f172a;font-weight:600;">${this.escapeHtml(
            value
          )}</td></tr>`
      )
      .join("");

    return `
      <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
          <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.08em;">${this.escapeHtml(
            input.eyebrow
          )}</p>
          <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.3;">${this.escapeHtml(
            input.title
          )}</h1>
          <p style="margin:16px 0;color:#334155;font-size:15px;line-height:1.6;">${this.escapeHtml(
            input.body
          )}</p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;margin-top:16px;font-size:14px;">
            ${detailRows}
          </table>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private async assertWebhookOwner(owner: AuthenticatedUser, webhookId: string) {
    const webhook = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookId }
    });

    if (!webhook) {
      throw new NotFoundException("Webhook not found.");
    }

    if (webhook.userId !== owner.workspaceOwnerId) {
      throw new ForbiddenException("You do not have access to this webhook.");
    }

    return webhook;
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
      throw new ForbiddenException("You do not have permission to manage notifications.");
    }
  }

  private readWebhookUrl(value: unknown) {
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
}
