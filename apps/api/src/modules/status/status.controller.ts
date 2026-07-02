import { Controller, Get, Param } from "@nestjs/common";
import { StatusService } from "./status.service";

@Controller("status")
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get(":workspaceSlug")
  getPublicStatus(@Param("workspaceSlug") workspaceSlug: string) {
    return this.statusService.getPublicStatus(workspaceSlug);
  }
}
