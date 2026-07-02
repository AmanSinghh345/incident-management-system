ALTER TABLE "WebhookEndpoint" ADD COLUMN "secret" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
