import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { TeamService } from "./team.service";

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@UseGuards(AuthGuard)
@Controller("team")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get("workspaces")
  listWorkspaces(@Req() request: AuthenticatedRequest) {
    return this.teamService.listWorkspaces(request.user);
  }

  @Get("members")
  listMembers(@Req() request: AuthenticatedRequest) {
    return this.teamService.listMembers(request.user);
  }

  @Get("invites")
  listInvites(@Req() request: AuthenticatedRequest) {
    return this.teamService.listInvites(request.user);
  }

  @Get("invites/received")
  listReceivedInvites(@Req() request: AuthenticatedRequest) {
    return this.teamService.listReceivedInvites(request.user);
  }

  @Post("invites")
  invite(
    @Req() request: AuthenticatedRequest,
    @Body() body: { email?: unknown; role?: unknown }
  ) {
    return this.teamService.invite(request.user, body);
  }

  @Post("invites/:id/accept")
  acceptInvite(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.teamService.acceptInvite(request.user, id);
  }

  @Post("invites/:id/cancel")
  cancelInvite(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.teamService.cancelInvite(request.user, id);
  }

  @Delete("members/:id")
  removeMember(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.teamService.removeMember(request.user, id);
  }
}
