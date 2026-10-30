
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import {
  NotificationChannel,
  NotificationStatus,
  WorkspaceRole
} from "@prisma/client";
import { NotificationsService } from "./notifications.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let fetchMock: jest.Mock;

  const owner = {
    workspaceOwnerId: "owner-1",
    workspaceSlug: "pulse-workspace",
    workspaceRole: WorkspaceRole.OWNER,
    email: "owner@example.com"
  } as AuthenticatedUser;

  const webhook = {
    id: "webhook-1",
    name: "Production webhook",
    url: "https://example.com/webhook",
    secret: "whsec_existing-secret",
    userId: "owner-1",
    isActive: true
  };

  const prisma = {
    webhookEndpoint: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    notification: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    incident: {
      findUnique: jest.fn()
    }
  };

  const configService = {
    get: jest.fn()
  };

  const auditLogService = {
    record: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    service = new NotificationsService(
      prisma as any,
      configService as any,
      auditLogService as any
    );

    configService.get.mockImplementation((key: string) => {
      if (key === "RESEND_API_KEY") return "test-api-key";
      if (key === "RESEND_FROM") return "PulseOps <test@example.com>";
      return undefined;
    });

    auditLogService.record.mockResolvedValue(undefined);
  });

  describe("listWebhooks", () => {
    it("should list webhooks belonging to the workspace owner", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([webhook]);

      const result = await service.listWebhooks(owner);

      expect(result).toEqual([webhook]);
      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: { userId: owner.workspaceOwnerId },
        orderBy: { createdAt: "desc" }
      });
    });
  });

  describe("listHistory", () => {
    it("should return the latest 50 notifications", async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.listHistory(owner);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe("createWebhook", () => {
    it("should create a webhook with a generated secret", async () => {
      prisma.webhookEndpoint.create.mockImplementation(({ data }) => ({
        id: "webhook-1",
        ...data
      }));

      const result = await service.createWebhook(owner, {
        name: " Production webhook ",
        url: "https://example.com/webhook"
      });

      expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Production webhook",
          url: "https://example.com/webhook",
          userId: owner.workspaceOwnerId,
          secret: expect.stringMatching(/^whsec_[a-f0-9]{64}$/)
        })
      });

      expect(auditLogService.record).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          action: "webhook.created",
          entityType: "webhook"
        })
      );

      expect(result.id).toBe("webhook-1");
    });

    it("should reject an empty webhook name", async () => {
      await expect(
        service.createWebhook(owner, {
          name: "   ",
          url: "https://example.com/webhook"
        })
      ).rejects.toThrow(BadRequestException);

      expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    });

    it("should reject an invalid webhook URL", async () => {
      await expect(
        service.createWebhook(owner, {
          name: "Test",
          url: "not-a-valid-url"
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject non-HTTP protocols", async () => {
      await expect(
        service.createWebhook(owner, {
          name: "Test",
          url: "ftp://example.com/file"
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should prevent members from creating webhooks", async () => {
      const member = {
        ...owner,
        workspaceRole: WorkspaceRole.MEMBER
      };

      await expect(
        service.createWebhook(member, {
          name: "Test",
          url: "https://example.com"
        })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    });
  });

  describe("updateWebhook", () => {
    it("should update webhook details", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.webhookEndpoint.update.mockResolvedValue({
        ...webhook,
        name: "Updated webhook",
        isActive: false
      });

      const result = await service.updateWebhook(owner, "webhook-1", {
        name: "Updated webhook",
        isActive: false
      });

      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" },
        data: {
          name: "Updated webhook",
          isActive: false
        }
      });

      expect(result.name).toBe("Updated webhook");
      expect(auditLogService.record).toHaveBeenCalled();
    });

    it("should normalize a valid updated URL", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.webhookEndpoint.update.mockResolvedValue(webhook);

      await service.updateWebhook(owner, "webhook-1", {
        url: "https://example.com/new"
      });

      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" },
        data: { url: "https://example.com/new" }
      });
    });

    it("should reject a non-boolean isActive value", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);

      await expect(
        service.updateWebhook(owner, "webhook-1", {
          isActive: "false" as any
        })
      ).rejects.toThrow(BadRequestException);

      expect(prisma.webhookEndpoint.update).not.toHaveBeenCalled();
    });

    it("should reject updating a webhook owned by another user", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue({
        ...webhook,
        userId: "another-owner"
      });

      await expect(
        service.updateWebhook(owner, "webhook-1", {
          name: "Changed"
        })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.webhookEndpoint.update).not.toHaveBeenCalled();
    });

    it("should reject updating a missing webhook", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(null);

      await expect(
        service.updateWebhook(owner, "missing-id", {
          name: "Changed"
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteWebhook", () => {
    it("should delete an owned webhook and record the audit log", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.webhookEndpoint.delete.mockResolvedValue(webhook);

      const result = await service.deleteWebhook(owner, "webhook-1");

      expect(result).toEqual({ deleted: true });
      expect(prisma.webhookEndpoint.delete).toHaveBeenCalledWith({
        where: { id: "webhook-1" }
      });

      expect(auditLogService.record).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          action: "webhook.deleted",
          entityId: "webhook-1"
        })
      );
    });

    it("should prevent deleting another user's webhook", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue({
        ...webhook,
        userId: "another-owner"
      });

      await expect(
        service.deleteWebhook(owner, "webhook-1")
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.webhookEndpoint.delete).not.toHaveBeenCalled();
    });
  });

  describe("rotateWebhookSecret", () => {
    it("should generate a new secret and update the webhook", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.webhookEndpoint.update.mockImplementation(({ data }) => ({
        ...webhook,
        ...data
      }));

      const result = await service.rotateWebhookSecret(owner, "webhook-1");

      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: "webhook-1" },
        data: {
          secret: expect.stringMatching(/^whsec_[a-f0-9]{64}$/)
        }
      });

      expect(result.secret).not.toBe(webhook.secret);
      expect(auditLogService.record).toHaveBeenCalledWith(
        owner,
        expect.objectContaining({
          action: "webhook.secret_rotated"
        })
      );
    });
  });

  describe("testWebhook", () => {
    it("should send a test webhook and save a successful notification", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.notification.create.mockResolvedValue({
        id: "notification-1",
        status: NotificationStatus.SENT
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await service.testWebhook(owner, "webhook-1");

      expect(fetchMock).toHaveBeenCalledWith(
        webhook.url,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-PulseOps-Event": "webhook.test",
            "X-PulseOps-Signature": expect.any(String),
            "X-PulseOps-Timestamp": expect.any(String)
          }),
          body: expect.any(String)
        })
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.WEBHOOK,
          status: NotificationStatus.SENT,
          recipient: webhook.url,
          userId: owner.workspaceOwnerId
        })
      });

      expect(result.status).toBe(NotificationStatus.SENT);
    });

    it("should record a failed notification when the webhook responds unsuccessfully", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.notification.create.mockResolvedValue({
        status: NotificationStatus.FAILED
      });

      fetchMock.mockResolvedValue({
        ok: false,
        status: 500
      });

      await service.testWebhook(owner, "webhook-1");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED
        })
      });
    });

    it("should reject testing a paused webhook", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue({
        ...webhook,
        isActive: false
      });

      await expect(
        service.testWebhook(owner, "webhook-1")
      ).rejects.toThrow(BadRequestException);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should record a failed notification if the webhook request throws", async () => {
      prisma.webhookEndpoint.findUnique.mockResolvedValue(webhook);
      prisma.notification.create.mockResolvedValue({
        status: NotificationStatus.FAILED
      });

      fetchMock.mockRejectedValue(new Error("Network error"));

      await service.testWebhook(owner, "webhook-1");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          message: "Network error"
        })
      });
    });
  });

  describe("testEmail", () => {
    it("should send a test email and save a successful notification", async () => {
      prisma.notification.create.mockResolvedValue({
        id: "email-notification-1",
        status: NotificationStatus.SENT
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: "resend-123" })
      });

      const result = await service.testEmail(owner);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key"
          }),
          body: expect.any(String)
        })
      );

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);

      expect(requestBody.to).toEqual([owner.email]);
      expect(requestBody.subject).toBe("PulseOps test email");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.SENT,
          recipient: owner.email,
          userId: owner.workspaceOwnerId
        })
      });

      expect(result.status).toBe(NotificationStatus.SENT);
    });

    it("should record a failed notification when Resend is not configured", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "RESEND_API_KEY") return undefined;
        if (key === "RESEND_FROM") return "PulseOps <test@example.com>";
        return undefined;
      });

      prisma.notification.create.mockResolvedValue({
        status: NotificationStatus.FAILED
      });

      await service.testEmail(owner);

      expect(fetchMock).not.toHaveBeenCalled();

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.FAILED,
          message: expect.stringContaining("RESEND_API_KEY")
        })
      });
    });

    it("should record a failed notification when Resend returns an error", async () => {
      prisma.notification.create.mockResolvedValue({
        status: NotificationStatus.FAILED
      });

      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          message: "Invalid API key"
        })
      });

      await service.testEmail(owner);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          message: expect.stringContaining("401")
        })
      });
    });
  });

  describe("incident notifications", () => {
    it("should do nothing when the incident does not exist", async () => {
      prisma.incident.findUnique.mockResolvedValue(null);

      await service.sendIncidentOpened("missing-incident");

      expect(prisma.webhookEndpoint.findMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("should send incident notifications to active webhooks and email", async () => {
      const incident = {
        id: "incident-1",
        title: "Production API is down",
        status: "OPEN",
        severity: "CRITICAL",
        startedAt: new Date("2026-10-30T10:00:00.000Z"),
        resolvedAt: null,
        monitor: {
          id: "monitor-1",
          name: "Production API",
          url: "https://api.example.com",
          status: "DOWN",
          ownerId: "owner-1",
          owner: {
            id: "owner-1",
            email: owner.email,
            name: "Owner",
            workspaceSlug: owner.workspaceSlug
          }
        },
        updates: [
          { message: "Health check failed repeatedly." }
        ]
      };

      prisma.incident.findUnique.mockResolvedValue(incident);
      prisma.webhookEndpoint.findMany.mockResolvedValue([webhook]);
      prisma.notification.create.mockImplementation(({ data }) => data);

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ id: "resend-123" })
      });

      await service.sendIncidentOpened("incident-1");

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: {
          userId: "owner-1",
          isActive: true
        }
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.WEBHOOK,
          status: NotificationStatus.SENT,
          incidentId: "incident-1",
          recipient: webhook.url
        })
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.SENT,
          incidentId: "incident-1",
          recipient: owner.email
        })
      });
    });
  });

  describe("email template escaping", () => {
    it("should escape HTML special characters in email content", () => {
      const html = (service as any).renderEmailTemplate({
        eyebrow: "TEST",
        title: "<script>alert('x')</script>",
        body: "A & B",
        details: [["Name", "\"PulseOps\""]]
      });

      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("A &amp; B");
      expect(html).toContain("&quot;PulseOps&quot;");
      expect(html).not.toContain("<script>");
    });
  });
});
