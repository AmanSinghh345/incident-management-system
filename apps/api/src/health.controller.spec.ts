import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it("should return health status", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe("pulseops-api");
  });

  afterAll(async () => {
    await app.close();
  });
});