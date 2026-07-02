import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { IncidentsService } from "./incidents.service";

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@UseGuards(AuthGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.incidentsService.list(request.user);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.incidentsService.get(request.user, id);
  }

  @Patch(":id/acknowledge")
  acknowledge(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.incidentsService.acknowledge(request.user, id);
  }

  @Patch(":id/resolve")
  resolve(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.incidentsService.resolve(request.user, id);
  }

  @Patch(":id/severity")
  updateSeverity(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { severity?: unknown }
  ) {
    return this.incidentsService.updateSeverity(request.user, id, body);
  }

  @Patch(":id/assign-to-me")
  assignToMe(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.incidentsService.assignToMe(request.user, id);
  }

  @Patch(":id/assign")
  assignToMember(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { userId?: unknown }
  ) {
    return this.incidentsService.assignToMember(request.user, id, body);
  }

  @Patch(":id/unassign")
  unassign(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.incidentsService.unassign(request.user, id);
  }

  @Post(":id/updates")
  addUpdate(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { message?: unknown }
  ) {
    return this.incidentsService.addUpdate(request.user, id, body);
  }
}
