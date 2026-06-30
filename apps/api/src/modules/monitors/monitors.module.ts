import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChecksModule } from "../checks/checks.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { WorkerModule } from "../worker/worker.module";
import { MonitorsController } from "./monitors.controller";
import { MonitorsService } from "./monitors.service";

@Module({
  imports: [AuthModule, ChecksModule, PrismaModule, RealtimeModule, WorkerModule],
  controllers: [MonitorsController],
  providers: [MonitorsService],
  exports: [MonitorsService]
})
export class MonitorsModule {}
