import {
  Controller,
  ForbiddenException,
  Query,
  Sse,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "../auth/auth-token.service";
import { RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Sse("events")
  async events(
    @Query("token") token?: string,
    @Query("workspaceOwnerId") requestedWorkspaceOwnerId?: string
  ) {
    if (!token) {
      throw new UnauthorizedException("Missing access token.");
    }

    const payload = this.authTokenService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true }
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists.");
    }

    const workspaceOwnerId = requestedWorkspaceOwnerId || user.id;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceOwnerId_userId: {
          workspaceOwnerId,
          userId: user.id
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this workspace.");
    }

    return this.realtimeService.subscribe(workspaceOwnerId);
  }
}
