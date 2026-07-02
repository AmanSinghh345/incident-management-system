import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException
} from "@nestjs/common";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "./auth-token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const payload = this.authTokenService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        workspaceSlug: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists.");
    }

    const requestedWorkspaceOwnerId = this.readWorkspaceOwnerId(
      request.headers["x-pulseops-workspace-owner-id"]
    );
    const workspaceOwnerId = requestedWorkspaceOwnerId ?? user.id;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId,
          userId: user.id
        }
      },
      include: {
        workspaceOwner: {
          select: {
            workspaceSlug: true
          }
        }
      }
    });

    if (!membership) {
      if (workspaceOwnerId === user.id) {
        const createdMembership = await this.prisma.workspaceMember.create({
          data: {
            workspaceOwnerId: user.id,
            userId: user.id,
            role: WorkspaceRole.OWNER
          },
          include: {
            workspaceOwner: {
              select: {
                workspaceSlug: true
              }
            }
          }
        });

        request.user = {
          ...user,
          workspaceOwnerId: user.id,
          workspaceRole: createdMembership.role,
          workspaceSlug: createdMembership.workspaceOwner.workspaceSlug
        };
        return true;
      }

      throw new ForbiddenException("You do not have access to this workspace.");
    }

    request.user = {
      ...user,
      workspaceOwnerId,
      workspaceRole: membership.role,
      workspaceSlug: membership.workspaceOwner.workspaceSlug
    };
    return true;
  }

  private readWorkspaceOwnerId(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
