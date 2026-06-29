import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ChecksService } from "./checks.service";

@Module({
  imports: [PrismaModule],
  providers: [ChecksService],
  exports: [ChecksService]
})
export class ChecksModule {}
