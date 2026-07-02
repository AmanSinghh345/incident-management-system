import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { AuditLogModule } from "./modules/audit/audit-log.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { MonitorsModule } from "./modules/monitors/monitors.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { ChecksModule } from "./modules/checks/checks.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { StatusModule } from "./modules/status/status.module";
import { TeamModule } from "./modules/team/team.module";
import { WorkerModule } from "./modules/worker/worker.module";
import { PrismaModule } from "./modules/prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditLogModule,
    AuthModule,
    UsersModule,
    MonitorsModule,
    IncidentsModule,
    ChecksModule,
    NotificationsModule,
    RealtimeModule,
    StatusModule,
    TeamModule,
    WorkerModule,
    PrismaModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
