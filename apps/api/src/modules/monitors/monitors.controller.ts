import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ChecksService } from "../checks/checks.service";
import { AuthenticatedUser, MonitorsService } from "./monitors.service";

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@UseGuards(AuthGuard)
@Controller("monitors")
export class MonitorsController {
  constructor(
    private readonly monitorsService: MonitorsService,
    private readonly checksService: ChecksService
  ) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.monitorsService.create(request.user, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.monitorsService.list(request.user);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.monitorsService.getForOwner(request.user, id);
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    return this.monitorsService.update(request.user, id, body ?? {});
  }

  @Delete(":id")
  delete(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.monitorsService.delete(request.user, id);
  }

  @Post(":id/check-now")
  checkNow(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.checksService.runNow(request.user, id);
  }

  @Get(":id/check-results")
  checkResults(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.checksService.listForMonitor(request.user, id);
  }
}
