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
import type { AuthenticatedUser } from "../monitors/monitors.service";
import { NotificationsService } from "./notifications.service";

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@UseGuards(AuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("history")
  listHistory(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.listHistory(request.user);
  }

  @Post("email/test")
  testEmail(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.testEmail(request.user);
  }

  @Get("webhooks")
  listWebhooks(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.listWebhooks(request.user);
  }

  @Post("webhooks")
  createWebhook(
    @Req() request: AuthenticatedRequest,
    @Body() body: { name?: unknown; url?: unknown }
  ) {
    return this.notificationsService.createWebhook(request.user, body);
  }

  @Patch("webhooks/:id")
  updateWebhook(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { name?: unknown; url?: unknown; isActive?: unknown }
  ) {
    return this.notificationsService.updateWebhook(request.user, id, body);
  }

  @Post("webhooks/:id/test")
  testWebhook(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notificationsService.testWebhook(request.user, id);
  }

  @Post("webhooks/:id/rotate-secret")
  rotateWebhookSecret(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    return this.notificationsService.rotateWebhookSecret(request.user, id);
  }

  @Delete("webhooks/:id")
  deleteWebhook(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notificationsService.deleteWebhook(request.user, id);
  }
}
