import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ChecksService } from "./checks.service";

@Module({
  imports: [PrismaModule, RealtimeModule],
  providers: [ChecksService],
  exports: [ChecksService]
})
export class ChecksModule {}
