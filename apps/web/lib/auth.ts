import { API_BASE_URL } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  workspaceSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export type MonitorStatus = "UP" | "DOWN" | "DEGRADED" | "PAUSED";
export type CheckStatus = "SUCCESS" | "FAILURE";
export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface CheckResult {
  id: string;
  monitorId: string;
  status: CheckStatus;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface IncidentSummary {
  id: string;
  title: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  authorId: string | null;
  message: string;
  createdAt: string;
}

export interface IncidentListItem extends IncidentSummary {
  monitor: {
    id: string;
    name: string;
    url: string;
    status: MonitorStatus;
  };
  updates: IncidentUpdate[];
}

export interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  failureThreshold: number;
  status: MonitorStatus;
  isActive: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  checkResults: CheckResult[];
  incidents: IncidentSummary[];
}

export interface MonitorDetail extends MonitorSummary {
  checkResults: CheckResult[];
  incidents: IncidentSummary[];
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  intervalSeconds: number;
  failureThreshold: number;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  failureThreshold?: number;
  isActive?: boolean;
}

export interface CheckNowResponse {
  monitor: Omit<MonitorSummary, "checkResults" | "incidents">;
  checkResult: CheckResult;
  incident: IncidentSummary | null;
}

export type RealtimeEventType =
  | "connected"
  | "monitor.changed"
  | "monitor.deleted"
  | "check.created"
  | "incident.changed";

export interface RealtimeHandlers {
  onOpen?: () => void;
  onEvent?: (eventType: RealtimeEventType) => void;
  onError?: () => void;
}

const TOKEN_KEY = "pulseops.accessToken";

export async function login(email: string, password: string) {
  return authRequest("/auth/login", { email, password });
}

export async function register(name: string, email: string, password: string) {
  return authRequest("/auth/register", { name, email, password });
}

export function saveAccessToken(accessToken: string) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
}

export function getAccessToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getCurrentUser(accessToken: string) {
  return authenticatedRequest<AuthUser>("/me", accessToken);
}

export function getMonitors(accessToken: string) {
  return authenticatedRequest<MonitorSummary[]>("/monitors", accessToken);
}

export function getMonitor(accessToken: string, monitorId: string) {
  return authenticatedRequest<MonitorDetail>(`/monitors/${monitorId}`, accessToken);
}

export function getMonitorCheckResults(accessToken: string, monitorId: string) {
  return authenticatedRequest<CheckResult[]>(
    `/monitors/${monitorId}/check-results`,
    accessToken
  );
}

export function createMonitor(accessToken: string, input: CreateMonitorInput) {
  return authenticatedRequest<MonitorSummary>("/monitors", accessToken, {
    method: "POST",
    body: input
  });
}

export function updateMonitorActiveState(
  accessToken: string,
  monitorId: string,
  isActive: boolean
) {
  return updateMonitor(accessToken, monitorId, { isActive });
}

export function updateMonitor(
  accessToken: string,
  monitorId: string,
  input: UpdateMonitorInput
) {
  return authenticatedRequest<MonitorSummary>(`/monitors/${monitorId}`, accessToken, {
    method: "PATCH",
    body: input
  });
}

export function deleteMonitor(accessToken: string, monitorId: string) {
  return authenticatedRequest<{ deleted: boolean }>(`/monitors/${monitorId}`, accessToken, {
    method: "DELETE"
  });
}

export function runMonitorCheck(accessToken: string, monitorId: string) {
  return authenticatedRequest<CheckNowResponse>(
    `/monitors/${monitorId}/check-now`,
    accessToken,
    { method: "POST" }
  );
}

export function getIncidents(accessToken: string) {
  return authenticatedRequest<IncidentListItem[]>("/incidents", accessToken);
}

export function acknowledgeIncident(accessToken: string, incidentId: string) {
  return authenticatedRequest<IncidentListItem>(
    `/incidents/${incidentId}/acknowledge`,
    accessToken,
    { method: "PATCH" }
  );
}

export function resolveIncident(accessToken: string, incidentId: string) {
  return authenticatedRequest<IncidentListItem>(
    `/incidents/${incidentId}/resolve`,
    accessToken,
    { method: "PATCH" }
  );
}

export function subscribeToRealtime(
  accessToken: string,
  handlers: RealtimeHandlers
) {
  const url = new URL(`${API_BASE_URL}/realtime/events`);
  url.searchParams.set("token", accessToken);

  const eventSource = new EventSource(url.toString());
  const eventTypes: RealtimeEventType[] = [
    "connected",
    "monitor.changed",
    "monitor.deleted",
    "check.created",
    "incident.changed"
  ];

  eventSource.onopen = () => handlers.onOpen?.();
  eventSource.onerror = () => handlers.onError?.();

  for (const eventType of eventTypes) {
    eventSource.addEventListener(eventType, () => handlers.onEvent?.(eventType));
  }

  return () => eventSource.close();
}

async function authRequest(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(data, "Authentication failed."));
  }

  return data as AuthResponse;
}

async function authenticatedRequest<T>(
  path: string,
  accessToken: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(data, "Request failed."));
  }

  return data as T;
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
