import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [AuthModule, PrismaModule, RealtimeModule],
  controllers: [IncidentsController],
  providers: [IncidentsService]
})
export class IncidentsModule {}
