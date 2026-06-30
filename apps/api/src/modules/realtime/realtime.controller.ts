import { Controller, Query, Sse, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "../auth/auth-token.service";
import { RealtimeService } from "./realtime.service";

@Controller("realtime")
export class RealtimeController {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Sse("events")
  async events(@Query("token") token?: string) {
    if (!token) {
      throw new UnauthorizedException("Missing access token.");
    }

    const payload = this.authTokenService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true }
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists.");
    }

    return this.realtimeService.subscribe(user.id);
  }
}
