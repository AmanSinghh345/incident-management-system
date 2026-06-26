import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
  const port = Number(configService.get<string>("BACKEND_PORT") ?? 4000);

  app.enableCors({
    origin: frontendUrl,
    credentials: true
  });

  await app.listen(port);
}

void bootstrap();
