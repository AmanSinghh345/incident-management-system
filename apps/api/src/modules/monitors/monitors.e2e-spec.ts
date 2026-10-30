import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "../auth/auth-token.service";
import { MonitorQueueService } from "../worker/monitor-queue.service";

describe("Monitors & Incidents API (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authTokenService: AuthTokenService;

  let ownerToken: string;
  let otherToken: string;

  const ownerEmail = "integration-owner@test.com";
  const otherEmail = "integration-other@test.com";

  const queueMock = {
    scheduleMonitor: jest.fn().mockResolvedValue(undefined),
    removeScheduledMonitor: jest.fn().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(MonitorQueueService)
      .useValue(queueMock)
      .compile();

    app = moduleRef.createNestApplication();

    await app.init();

    prisma = app.get(PrismaService);
    authTokenService = app.get(AuthTokenService);

    await prisma.user.deleteMany({
      where: {
        email: { in: [ownerEmail, otherEmail, "integration-member@test.com"] }
      }
    });

    const owner = await prisma.user.create({
      data: {
        name: "Integration Owner",
        email: ownerEmail,
        passwordHash: "test-hash",
        workspaceSlug: "integration-owner"
      }
    });

    const other = await prisma.user.create({
      data: {
        name: "Integration Other",
        email: otherEmail,
        passwordHash: "test-hash",
        workspaceSlug: "integration-other"
      }
    });

    ownerToken = authTokenService.sign({
      sub: owner.id,
      email: owner.email,
      workspaceSlug: owner.workspaceSlug
    });

    otherToken = authTokenService.sign({
      sub: other.id,
      email: other.email,
      workspaceSlug: other.workspaceSlug
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [ownerEmail, otherEmail, "integration-member@test.com"] }
      }
    });

    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMonitor = (token: string, name = "Integration Monitor") => {
    return request(app.getHttpServer())
      .post("/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name,
        url: "https://example.com",
        intervalSeconds: 60,
        failureThreshold: 3
      });
  };

  const createIncident = async (token = ownerToken, title = "Integration Test Incident") => {
    const monitorResponse = await createMonitor(token, "Incident Test Monitor");
    return prisma.incident.create({
      data: {
        title,
        monitorId: monitorResponse.body.id
      }
    });
  };

  const createWorkspaceMember = async () => {
    const member = await prisma.user.create({
      data: {
        name: "Integration Member",
        email: "integration-member@test.com",
        passwordHash: "test-hash",
        workspaceSlug: "integration-member"
      }
    });

    const membership = await prisma.workspaceMember.create({
      data: {
        workspaceOwnerId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: ownerEmail }
          })
        ).id,
        userId: member.id,
        role: "MEMBER"
      }
    });

    return { member, membership };
  };

  // --- MONITOR TESTS ---

  it("should create a monitor and save it in PostgreSQL", async () => {
    const response = await createMonitor(ownerToken);

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe("Integration Monitor");

    const savedMonitor = await prisma.monitor.findUnique({
      where: { id: response.body.id }
    });

    expect(savedMonitor).not.toBeNull();
    expect(savedMonitor?.url).toBe("https://example.com/");
    expect(savedMonitor?.isActive).toBe(true);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: response.body.id,
        action: "monitor.created"
      }
    });

    expect(auditLog).not.toBeNull();
    expect(queueMock.scheduleMonitor).toHaveBeenCalledWith(
      response.body.id
    );
  });

  it("should list monitors belonging to the authenticated workspace", async () => {
    await createMonitor(ownerToken, "List Test Monitor");

    const response = await request(app.getHttpServer())
      .get("/monitors")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "List Test Monitor"
        })
      ])
    );
  });

  it("should retrieve a monitor by ID", async () => {
    const created = await createMonitor(ownerToken, "Get Test Monitor");

    const response = await request(app.getHttpServer())
      .get(`/monitors/${created.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.name).toBe("Get Test Monitor");
  });

  it("should update a monitor", async () => {
    const created = await createMonitor(ownerToken, "Update Test Monitor");

    const response = await request(app.getHttpServer())
      .patch(`/monitors/${created.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Updated Monitor",
        intervalSeconds: 120
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Monitor");
    expect(response.body.intervalSeconds).toBe(120);

    const saved = await prisma.monitor.findUnique({
      where: { id: created.body.id }
    });

    expect(saved?.name).toBe("Updated Monitor");
  });

  it("should delete a monitor", async () => {
    const created = await createMonitor(ownerToken, "Delete Test Monitor");

    const response = await request(app.getHttpServer())
      .delete(`/monitors/${created.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.deleted).toBe(true);

    const saved = await prisma.monitor.findUnique({
      where: { id: created.body.id }
    });

    expect(saved).toBeNull();
  });

  it("should reject requests without a bearer token", async () => {
    const response = await request(app.getHttpServer())
      .get("/monitors");

    expect(response.status).toBe(401);
  });

  it("should reject invalid monitor input", async () => {
    const response = await request(app.getHttpServer())
      .post("/monitors")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "",
        url: "not-a-valid-url"
      });

    expect(response.status).toBe(400);
  });

  it("should prevent access to another workspace's monitor", async () => {
    const created = await createMonitor(
      ownerToken,
      "Private Workspace Monitor"
    );

    const response = await request(app.getHttpServer())
      .get(`/monitors/${created.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it("should return monitor statistics based on persisted check results", async () => {
    const created = await createMonitor(ownerToken, "Stats Test Monitor");

    await prisma.checkResult.createMany({
      data: [
        {
          monitorId: created.body.id,
          status: "SUCCESS",
          responseTimeMs: 100
        },
        {
          monitorId: created.body.id,
          status: "SUCCESS",
          responseTimeMs: 200
        },
        {
          monitorId: created.body.id,
          status: "FAILURE",
          responseTimeMs: 300
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get(`/monitors/${created.body.id}/stats`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.last24h.totalChecks).toBe(3);
    expect(response.body.last24h.successfulChecks).toBe(2);
    expect(response.body.last24h.failedChecks).toBe(1);
    expect(response.body.last24h.uptimePercentage).toBe(66.67);
    expect(response.body.last24h.averageResponseTimeMs).toBe(200);
    expect(response.body.hourlyTimeline).toHaveLength(24);
  });

  it("should return check results in descending date order", async () => {
    const created = await createMonitor(ownerToken, "History Test Monitor");

    const olderDate = new Date(Date.now() - 60000);
    const newerDate = new Date();

    await prisma.checkResult.createMany({
      data: [
        {
          monitorId: created.body.id,
          status: "SUCCESS",
          responseTimeMs: 120,
          checkedAt: olderDate
        },
        {
          monitorId: created.body.id,
          status: "FAILURE",
          responseTimeMs: 250,
          checkedAt: newerDate
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get(`/monitors/${created.body.id}/check-results`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].status).toBe("FAILURE");
    expect(response.body[1].status).toBe("SUCCESS");
    expect(new Date(response.body[0].checkedAt).getTime())
      .toBeGreaterThan(new Date(response.body[1].checkedAt).getTime());
  });

  it("should record a failure when manually checking a paused monitor", async () => {
    const created = await createMonitor(ownerToken, "Paused Check Monitor");

    await prisma.monitor.update({
      where: { id: created.body.id },
      data: {
        isActive: false,
        status: "PAUSED"
      }
    });

    const response = await request(app.getHttpServer())
      .post(`/monitors/${created.body.id}/check-now`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(201);
    expect(response.body.checkResult.status).toBe("FAILURE");
    expect(response.body.checkResult.errorMessage).toBe("Monitor is paused.");

    const savedResult = await prisma.checkResult.findFirst({
      where: { monitorId: created.body.id }
    });

    expect(savedResult).not.toBeNull();
    expect(savedResult?.status).toBe("FAILURE");
  });

  it("should prevent another workspace from accessing monitor statistics", async () => {
    const created = await createMonitor(ownerToken, "Private Stats Monitor");

    const response = await request(app.getHttpServer())
      .get(`/monitors/${created.body.id}/stats`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it("should prevent another workspace from manually checking a monitor", async () => {
    const created = await createMonitor(ownerToken, "Private Manual Check Monitor");

    const response = await request(app.getHttpServer())
      .post(`/monitors/${created.body.id}/check-now`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it("should return 404 when requesting a non-existent monitor", async () => {
    const response = await request(app.getHttpServer())
      .get("/monitors/non-existent-monitor-id")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
  });

  // --- INCIDENT TESTS ---

  it("should list incidents belonging to the authenticated workspace", async () => {
    const incident = await createIncident(ownerToken, "List Test Incident");

    const response = await request(app.getHttpServer())
      .get("/incidents")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: incident.id,
          title: "List Test Incident"
        })
      ])
    );
  });

  it("should retrieve incident details by ID", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .get(`/incidents/${incident.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(incident.id);
    expect(response.body.title).toBe(incident.title);
    expect(response.body.monitor).toBeDefined();
  });

  it("should acknowledge an incident and create a timeline update", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/acknowledge`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ACKNOWLEDGED");

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id },
      include: { updates: true }
    });

    expect(saved?.status).toBe("ACKNOWLEDGED");
    expect(saved?.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Incident acknowledged." })
      ])
    );

    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: incident.id, action: "incident.acknowledged" }
    });
    expect(auditLog).not.toBeNull();
  });

  it("should resolve an incident and record its resolution time", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/resolve`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("RESOLVED");
    expect(response.body.resolvedAt).not.toBeNull();

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.status).toBe("RESOLVED");
    expect(saved?.resolvedAt).not.toBeNull();
  });

  it("should update incident severity", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/severity`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ severity: "CRITICAL" });

    expect(response.status).toBe(200);
    expect(response.body.severity).toBe("CRITICAL");

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.severity).toBe("CRITICAL");
  });

  it("should reject an invalid incident severity", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/severity`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ severity: "URGENT" });

    expect(response.status).toBe(400);
  });

  it("should assign an incident to the authenticated user", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/assign-to-me`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);

    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail }
    });

    expect(response.body.assignedToId).toBe(owner?.id);

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.assignedToId).toBe(owner?.id);
  });

  it("should unassign an incident", async () => {
    const incident = await createIncident();
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail }
    });

    await prisma.incident.update({
      where: { id: incident.id },
      data: { assignedToId: owner!.id }
    });

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/unassign`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.assignedToId).toBeNull();

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.assignedToId).toBeNull();
  });

  it("should add an update to an incident timeline", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .post(`/incidents/${incident.id}/updates`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ message: "Investigating the server outage." });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Investigating the server outage.");

    const saved = await prisma.incidentUpdate.findFirst({
      where: { incidentId: incident.id, message: "Investigating the server outage." }
    });
    expect(saved).not.toBeNull();
  });

  it("should reject an empty incident timeline update", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .post(`/incidents/${incident.id}/updates`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ message: "   " });

    expect(response.status).toBe(400);
  });

  it("should prevent another workspace from accessing an incident", async () => {
    const incident = await createIncident(ownerToken);

    const response = await request(app.getHttpServer())
      .get(`/incidents/${incident.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it("should prevent another workspace from resolving an incident", async () => {
    const incident = await createIncident(ownerToken);

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/resolve`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.status).toBe("OPEN");
  });

  it("should assign an incident to a workspace member", async () => {
    const incident = await createIncident();
    const { member } = await createWorkspaceMember();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/assign`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: member.id });

    expect(response.status).toBe(200);
    expect(response.body.assignedToId).toBe(member.id);
    expect(response.body.assignedTo.id).toBe(member.id);

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.assignedToId).toBe(member.id);

    const update = await prisma.incidentUpdate.findFirst({
      where: { incidentId: incident.id, message: "Assigned to Integration Member." }
    });
    expect(update).not.toBeNull();
  });

  it("should reject assigning an incident to a non-member", async () => {
    const incident = await createIncident();

    const response = await request(app.getHttpServer())
      .patch(`/incidents/${incident.id}/assign`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: "non-existent-user-id" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Assignee must be a workspace member.");

    const saved = await prisma.incident.findUnique({
      where: { id: incident.id }
    });
    expect(saved?.assignedToId).toBeNull();
  });

  // --- TEAM INVITATION TESTS ---

  it("should create a workspace invitation with a normalized email", async () => {
    const response = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "  NewMember@Test.com  " });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe("newmember@test.com");
    expect(response.body.role).toBe("MEMBER");
    expect(response.body.status).toBe("PENDING");

    const saved = await prisma.workspaceInvite.findUnique({
      where: { id: response.body.id }
    });
    expect(saved?.email).toBe("newmember@test.com");
    expect(saved?.role).toBe("MEMBER");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "team.invite_created", entityId: response.body.id }
    });
    expect(audit).not.toBeNull();
  });

  it("should create an invitation with ADMIN role", async () => {
    const response = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "integration-admin@test.com", role: "admin" });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe("ADMIN");
    expect(response.body.status).toBe("PENDING");
  });

  it("should list invitations sent by the workspace owner", async () => {
    await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "integration-list@test.com" });

    const response = await request(app.getHttpServer())
      .get("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(
      response.body.some(
        (invite: any) => invite.email === "integration-list@test.com"
      )
    ).toBe(true);
  });

  it("should reject an invalid invitation email", async () => {
    const response = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Email must be valid.");
  });

  it("should reject duplicate pending invitations", async () => {
    const email = "integration-duplicate@test.com";

    const first = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email });

    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email });

    expect(second.status).toBe(400);
    expect(second.body.message).toBe("A pending invite already exists for this email.");
  });

  it("should allow a user to receive and accept a workspace invitation", async () => {
    const inviteResponse = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: otherEmail, role: "MEMBER" });

    expect(inviteResponse.status).toBe(201);
    const inviteId = inviteResponse.body.id;

    const receivedResponse = await request(app.getHttpServer())
      .get("/team/invites/received")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(receivedResponse.status).toBe(200);
    expect(
      receivedResponse.body.some((invite: any) => invite.id === inviteId)
    ).toBe(true);

    const unauthorizedResponse = await request(app.getHttpServer())
      .post(`/team/invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(unauthorizedResponse.status).toBe(403);

    const acceptResponse = await request(app.getHttpServer())
      .post(`/team/invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(acceptResponse.status).toBe(201);
    expect(acceptResponse.body.user.id).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } })).id
    );
    expect(acceptResponse.body.role).toBe("MEMBER");

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: (
            await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } })
          ).id,
          userId: (
            await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } })
          ).id
        }
      }
    });

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe("MEMBER");

    const savedInvite = await prisma.workspaceInvite.findUnique({
      where: { id: inviteId }
    });
    expect(savedInvite?.status).toBe("ACCEPTED");
    expect(savedInvite?.acceptedUserId).toBe(acceptResponse.body.user.id);
    expect(savedInvite?.acceptedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "team.invite_accepted", entityId: inviteId }
    });
    expect(audit).not.toBeNull();

    const secondAcceptResponse = await request(app.getHttpServer())
      .post(`/team/invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(secondAcceptResponse.status).toBe(400);
    expect(secondAcceptResponse.body.message).toBe("This invite is no longer pending.");
  });

  it("should return 404 when accepting a non-existent invitation", async () => {
    const response = await request(app.getHttpServer())
      .post("/team/invites/non-existent-invite-id/accept")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Invite not found.");
  });

  // --- TEAM CANCELLATION & MEMBER REMOVAL TESTS ---

  it("should cancel a pending workspace invitation", async () => {
    const inviteResponse = await request(app.getHttpServer())
      .post("/team/invites")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "integration-cancel@test.com" });

    expect(inviteResponse.status).toBe(201);
    const inviteId = inviteResponse.body.id;

    const response = await request(app.getHttpServer())
      .post(`/team/invites/${inviteId}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CANCELLED");

    const saved = await prisma.workspaceInvite.findUnique({
      where: { id: inviteId }
    });
    expect(saved?.status).toBe("CANCELLED");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "team.invite_cancelled", entityId: inviteId }
    });
    expect(audit).not.toBeNull();
  });

  it("should reject cancellation of an accepted invitation", async () => {
    const invite = await prisma.workspaceInvite.findFirstOrThrow({
      where: { email: otherEmail, status: "ACCEPTED" }
    });

    const response = await request(app.getHttpServer())
      .post(`/team/invites/${invite.id}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Only pending invites can be cancelled.");
  });

  it("should remove a workspace member", async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: ownerEmail }
    });
    const member = await prisma.user.findUniqueOrThrow({
      where: { email: otherEmail }
    });
    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: owner.id,
          userId: member.id
        }
      }
    });

    const response = await request(app.getHttpServer())
      .delete(`/team/members/${membership.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.deleted).toBe(true);

    const saved = await prisma.workspaceMember.findUnique({
      where: { id: membership.id }
    });
    expect(saved).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "team.member_removed", entityId: membership.id }
    });
    expect(audit).not.toBeNull();
  });

  it("should prevent removal of the workspace owner", async () => {
    await request(app.getHttpServer())
      .get("/team/members")
      .set("Authorization", `Bearer ${ownerToken}`);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: ownerEmail }
    });
    const membership = await prisma.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: owner.id,
          userId: owner.id
        }
      }
    });

    const response = await request(app.getHttpServer())
      .delete(`/team/members/${membership.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("The workspace owner cannot be removed.");

    const saved = await prisma.workspaceMember.findUnique({
      where: { id: membership.id }
    });
    expect(saved).not.toBeNull();
  });
});