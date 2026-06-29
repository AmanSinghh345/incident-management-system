import { Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
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
}
