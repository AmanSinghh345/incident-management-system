import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { AuditLogService } from "./audit-log.service";

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@UseGuards(AuthGuard)
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.auditLogService.list(request.user);
  }
}
