import { Controller, Get, Head } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "pulseops-api",
      time: new Date().toISOString()
    };
  }

  @Head()
  headHealth() {
    return;
  }
}
