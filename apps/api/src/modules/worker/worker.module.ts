import { Module } from "@nestjs/common";
import { ChecksModule } from "../checks/checks.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MonitorQueueService } from "./monitor-queue.service";

@Module({
  imports: [ChecksModule, PrismaModule],
  providers: [MonitorQueueService],
  exports: [MonitorQueueService]
})
export class WorkerModule {}
