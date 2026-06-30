import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
