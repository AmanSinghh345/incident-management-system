import { API_BASE_URL } from "./api";
import type {
  CheckResult,
  IncidentSeverity,
  IncidentStatus,
  MonitorStatus
} from "./auth";

export type PublicStatusValue =
  | "OPERATIONAL"
  | "PARTIAL_OUTAGE"
  | "MAJOR_OUTAGE"
  | "PAUSED"
  | "NO_MONITORS";

export interface PublicStatusIncident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: string;
  resolvedAt: string | null;
  updates: {
    id: string;
    message: string;
    createdAt: string;
  }[];
  monitor: {
    id: string;
    name: string;
    url: string | null;
    status: MonitorStatus;
  };
}

export interface PublicStatusMonitor {
  id: string;
  name: string;
  url: string | null;
  status: MonitorStatus;
  isActive: boolean;
  latestCheck: CheckResult | null;
  uptime: {
    last24h: PublicUptimeSummary;
    last7d: PublicUptimeSummary;
  };
  activeIncident: Omit<PublicStatusIncident, "monitor"> | null;
}

export interface PublicUptimeSummary {
  totalChecks: number;
  uptimePercentage: number | null;
  averageResponseTimeMs: number | null;
}

export interface PublicStatusPage {
  workspace: {
    name: string;
    slug: string;
  };
  summary: {
    status: PublicStatusValue;
    totalMonitors: number;
    activeMonitors: number;
    openIncidents: number;
  };
  monitors: PublicStatusMonitor[];
  incidents: PublicStatusIncident[];
  recentIncidents: PublicStatusIncident[];
  generatedAt: string;
}

export async function getPublicStatus(workspaceSlug: string) {
  const response = await fetch(
    `${API_BASE_URL}/status/${encodeURIComponent(workspaceSlug)}`,
    { cache: "no-store" }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(data, "Could not load status page."));
  }

  return data as PublicStatusPage;
}

function readErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}
