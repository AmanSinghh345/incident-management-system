CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TABLE "Incident" ADD COLUMN "severity" "IncidentSeverity" NOT NULL DEFAULT 'HIGH';
