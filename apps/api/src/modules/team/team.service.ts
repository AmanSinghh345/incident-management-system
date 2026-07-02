import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { WorkspaceInviteStatus, WorkspaceRole } from "@prisma/client";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { PrismaService } from "../prisma/prisma.service";

interface InviteBody {
  email?: unknown;
  role?: unknown;
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

  async listWorkspaces(owner: AuthenticatedUser) {
    await this.ensureOwnerMembership(owner);

    return this.prisma.workspaceMember.findMany({
      where: { userId: owner.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        workspaceOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            workspaceSlug: true
          }
        }
      }
    });
  }

  async listMembers(owner: AuthenticatedUser) {
    await this.ensureOwnerMembership(owner);

    return this.prisma.workspaceMember.findMany({
      where: { workspaceOwnerId: owner.workspaceOwnerId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async listInvites(owner: AuthenticatedUser) {
    await this.assertCanManageTeam(owner);

    return this.prisma.workspaceInvite.findMany({
      where: { workspaceOwnerId: owner.workspaceOwnerId },
      orderBy: { createdAt: "desc" }
    });
  }

  listReceivedInvites(owner: AuthenticatedUser) {
    return this.prisma.workspaceInvite.findMany({
      where: {
        email: owner.email,
        status: WorkspaceInviteStatus.PENDING
      },
      orderBy: { createdAt: "desc" },
      include: {
        workspaceOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            workspaceSlug: true
          }
        }
      }
    });
  }

  async invite(owner: AuthenticatedUser, body: InviteBody) {
    await this.assertCanManageTeam(owner);
    const email = this.normalizeEmail(body.email);
    const role = this.readInviteRole(body.role);

    if (email === owner.email) {
      throw new BadRequestException("You are already the workspace owner.");
    }

    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceOwnerId: owner.workspaceOwnerId,
        user: { email }
      }
    });

    if (existingMember) {
      throw new BadRequestException("That user is already a workspace member.");
    }

    const pendingInvite = await this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceOwnerId: owner.workspaceOwnerId,
        email,
        status: WorkspaceInviteStatus.PENDING
      }
    });

    if (pendingInvite) {
      throw new BadRequestException("A pending invite already exists for this email.");
    }

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceOwnerId: owner.workspaceOwnerId,
        email,
        role
      }
    });

    await this.auditLogService.record(owner, {
      action: "team.invite_created",
      entityType: "workspace_invite",
      entityId: invite.id,
      summary: `Invited ${email} as ${role}.`,
      metadata: { email, role }
    });

    return invite;
  }

  async acceptInvite(owner: AuthenticatedUser, inviteId: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite) {
      throw new NotFoundException("Invite not found.");
    }

    if (invite.email !== owner.email) {
      throw new ForbiddenException("This invite belongs to another email address.");
    }

    if (invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new BadRequestException("This invite is no longer pending.");
    }

    const member = await this.prisma.$transaction(async (prisma) => {
      const member = await prisma.workspaceMember.upsert({
        where: {
          workspaceOwnerId_userId: {
            workspaceOwnerId: invite.workspaceOwnerId,
            userId: owner.id
          }
        },
        update: {
          role: invite.role
        },
        create: {
          workspaceOwnerId: invite.workspaceOwnerId,
          userId: owner.id,
          role: invite.role
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          status: WorkspaceInviteStatus.ACCEPTED,
          acceptedUserId: owner.id,
          acceptedAt: new Date()
        }
      });

      return member;
    });

    await this.auditLogService.record(
      {
        ...owner,
        workspaceOwnerId: invite.workspaceOwnerId,
        workspaceRole: member.role
      },
      {
        action: "team.invite_accepted",
        entityType: "workspace_invite",
        entityId: invite.id,
        summary: `${owner.email} accepted a workspace invite.`,
        metadata: { email: owner.email, role: member.role }
      }
    );

    return member;
  }

  async cancelInvite(owner: AuthenticatedUser, inviteId: string) {
    await this.assertCanManageTeam(owner);
    const invite = await this.assertInviteOwner(owner, inviteId);

    if (invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new BadRequestException("Only pending invites can be cancelled.");
    }

    const updatedInvite = await this.prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: { status: WorkspaceInviteStatus.CANCELLED }
    });

    await this.auditLogService.record(owner, {
      action: "team.invite_cancelled",
      entityType: "workspace_invite",
      entityId: inviteId,
      summary: `Cancelled invite for ${invite.email}.`,
      metadata: { email: invite.email }
    });

    return updatedInvite;
  }

  async removeMember(owner: AuthenticatedUser, memberId: string) {
    await this.assertCanManageTeam(owner);
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.workspaceOwnerId !== owner.workspaceOwnerId) {
      throw new NotFoundException("Member not found.");
    }

    if (member.userId === owner.workspaceOwnerId) {
      throw new BadRequestException("The workspace owner cannot be removed.");
    }

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });
    await this.auditLogService.record(owner, {
      action: "team.member_removed",
      entityType: "workspace_member",
      entityId: memberId,
      summary: "Removed a team member.",
      metadata: { userId: member.userId }
    });

    return { deleted: true };
  }

  async assertWorkspaceMember(owner: AuthenticatedUser, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: owner.workspaceOwnerId,
          userId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!member) {
      throw new BadRequestException("Assignee must be a workspace member.");
    }

    return member;
  }

  private async ensureOwnerMembership(owner: AuthenticatedUser) {
    return this.prisma.workspaceMember.upsert({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId: owner.id,
          userId: owner.id
        }
      },
      update: {},
      create: {
        workspaceOwnerId: owner.id,
        userId: owner.id,
        role: WorkspaceRole.OWNER
      }
    });
  }

  private async assertCanManageTeam(owner: AuthenticatedUser) {
    const membership = await this.ensureOwnerMembership(owner);

    if (
      owner.workspaceRole !== WorkspaceRole.OWNER &&
      owner.workspaceRole !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to manage this team.");
    }

    return membership;
  }

  private async assertInviteOwner(owner: AuthenticatedUser, inviteId: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId }
    });

    if (!invite || invite.workspaceOwnerId !== owner.workspaceOwnerId) {
      throw new NotFoundException("Invite not found.");
    }

    return invite;
  }

  private readInviteRole(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return WorkspaceRole.MEMBER;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("role must be a string.");
    }

    const role = value.trim().toUpperCase();

    if (role !== WorkspaceRole.ADMIN && role !== WorkspaceRole.MEMBER) {
      throw new BadRequestException("role must be ADMIN or MEMBER.");
    }

    return role as WorkspaceRole;
  }

  private normalizeEmail(value: unknown) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException("email is required.");
    }

    const email = value.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Email must be valid.");
    }

    return email;
  }
}
