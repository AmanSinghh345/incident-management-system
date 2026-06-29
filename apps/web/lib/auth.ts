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

export interface CreateMonitorInput {
  name: string;
  url: string;
  intervalSeconds: number;
  failureThreshold: number;
}

export interface CheckNowResponse {
  monitor: Omit<MonitorSummary, "checkResults" | "incidents">;
  checkResult: CheckResult;
  incident: IncidentSummary | null;
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
  return authenticatedRequest<MonitorSummary>(`/monitors/${monitorId}`, accessToken, {
    method: "PATCH",
    body: { isActive }
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
