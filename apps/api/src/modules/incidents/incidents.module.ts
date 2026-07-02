import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TeamModule } from "../team/team.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [
    AuditLogModule,
    AuthModule,
    NotificationsModule,
    PrismaModule,
    RealtimeModule,
    TeamModule
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService]
})
export class IncidentsModule {}
