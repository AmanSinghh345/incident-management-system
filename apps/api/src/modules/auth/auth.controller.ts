import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("auth/register")
  register(@Body() body: unknown) {
    return this.authService.register(body ?? {});
  }

  @Post("auth/login")
  login(@Body() body: unknown) {
    return this.authService.login(body ?? {});
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() request: { user: unknown }) {
    return request.user;
  }
}
