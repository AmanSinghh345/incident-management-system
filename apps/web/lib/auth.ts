import { API_BASE_URL } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  workspaceSlug: string;
  workspaceOwnerId: string;
  workspaceRole: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export type MonitorStatus = "UP" | "DOWN" | "DEGRADED" | "PAUSED";
export type MonitorMethod = "GET" | "POST" | "HEAD";
export type CheckStatus = "SUCCESS" | "FAILURE";
export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WorkspaceInviteStatus = "PENDING" | "ACCEPTED" | "CANCELLED";

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
  severity: IncidentSeverity;
  startedAt: string;
  resolvedAt: string | null;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  authorId: string | null;
  message: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface IncidentAssignee {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceOwnerId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceInvite {
  id: string;
  workspaceOwnerId: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceInviteStatus;
  acceptedUserId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedWorkspaceInvite extends WorkspaceInvite {
  workspaceOwner: {
    id: string;
    name: string;
    email: string;
    workspaceSlug: string;
  };
}

export interface WorkspaceAccess {
  id: string;
  workspaceOwnerId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  workspaceOwner: {
    id: string;
    name: string;
    email: string;
    workspaceSlug: string;
  };
}

export interface IncidentListItem extends IncidentSummary {
  monitor: {
    id: string;
    name: string;
    url: string;
    status: MonitorStatus;
  };
  assignedTo: IncidentAssignee | null;
  updates: IncidentUpdate[];
}

export interface IncidentDetail extends IncidentListItem {
  monitor: MonitorSummary;
  notifications: {
    id: string;
    channel: string;
    status: string;
    createdAt: string;
    sentAt: string | null;
  }[];
}

export interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  method: MonitorMethod;
  expectedStatusCode: number;
  timeoutSeconds: number;
  isPublic: boolean;
  publicName: string | null;
  showUrl: boolean;
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

export interface MonitorStatsSummary {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number | null;
  averageResponseTimeMs: number | null;
}

export interface MonitorStatsBucket extends MonitorStatsSummary {
  start: string;
  end: string;
}

export interface MonitorStats {
  window: {
    generatedAt: string;
    last24hStart: string;
    last7dStart: string;
  };
  last24h: MonitorStatsSummary;
  last7d: MonitorStatsSummary;
  hourlyTimeline: MonitorStatsBucket[];
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  method: MonitorMethod;
  expectedStatusCode: number;
  timeoutSeconds: number;
  isPublic: boolean;
  publicName?: string;
  showUrl: boolean;
  intervalSeconds: number;
  failureThreshold: number;
}

export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  method?: MonitorMethod;
  expectedStatusCode?: number;
  timeoutSeconds?: number;
  isPublic?: boolean;
  publicName?: string | null;
  showUrl?: boolean;
  intervalSeconds?: number;
  failureThreshold?: number;
  isActive?: boolean;
}

export interface CheckNowResponse {
  monitor: Omit<MonitorSummary, "checkResults" | "incidents">;
  checkResult: CheckResult;
  incident: IncidentSummary | null;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationHistoryItem {
  id: string;
  channel: string;
  status: "PENDING" | "SENT" | "FAILED";
  recipient: string;
  subject: string;
  message: string;
  userId: string | null;
  incidentId: string | null;
  sentAt: string | null;
  createdAt: string;
  incident: {
    id: string;
    title: string;
    status: IncidentStatus;
  } | null;
}

export interface AuditLogItem {
  id: string;
  workspaceOwnerId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
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
const WORKSPACE_OWNER_KEY = "pulseops.workspaceOwnerId";

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
  window.localStorage.removeItem(WORKSPACE_OWNER_KEY);
}

export function getActiveWorkspaceOwnerId() {
  return window.localStorage.getItem(WORKSPACE_OWNER_KEY);
}

export function saveActiveWorkspaceOwnerId(workspaceOwnerId: string) {
  window.localStorage.setItem(WORKSPACE_OWNER_KEY, workspaceOwnerId);
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

export function getMonitorStats(accessToken: string, monitorId: string) {
  return authenticatedRequest<MonitorStats>(`/monitors/${monitorId}/stats`, accessToken);
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

export function getIncident(accessToken: string, incidentId: string) {
  return authenticatedRequest<IncidentDetail>(`/incidents/${incidentId}`, accessToken);
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

export function updateIncidentSeverity(
  accessToken: string,
  incidentId: string,
  severity: IncidentSeverity
) {
  return authenticatedRequest<IncidentListItem>(
    `/incidents/${incidentId}/severity`,
    accessToken,
    {
      method: "PATCH",
      body: { severity }
    }
  );
}

export function assignIncidentToMe(accessToken: string, incidentId: string) {
  return authenticatedRequest<IncidentListItem>(
    `/incidents/${incidentId}/assign-to-me`,
    accessToken,
    { method: "PATCH" }
  );
}

export function assignIncidentToMember(
  accessToken: string,
  incidentId: string,
  userId: string
) {
  return authenticatedRequest<IncidentListItem>(`/incidents/${incidentId}/assign`, accessToken, {
    method: "PATCH",
    body: { userId }
  });
}

export function unassignIncident(accessToken: string, incidentId: string) {
  return authenticatedRequest<IncidentListItem>(
    `/incidents/${incidentId}/unassign`,
    accessToken,
    { method: "PATCH" }
  );
}

export function addIncidentUpdate(
  accessToken: string,
  incidentId: string,
  message: string
) {
  return authenticatedRequest<IncidentUpdate>(`/incidents/${incidentId}/updates`, accessToken, {
    method: "POST",
    body: { message }
  });
}

export function getWebhookEndpoints(accessToken: string) {
  return authenticatedRequest<WebhookEndpoint[]>("/notifications/webhooks", accessToken);
}

export function getTeamMembers(accessToken: string) {
  return authenticatedRequest<WorkspaceMember[]>("/team/members", accessToken);
}

export function getWorkspaceInvites(accessToken: string) {
  return authenticatedRequest<WorkspaceInvite[]>("/team/invites", accessToken);
}

export function getReceivedWorkspaceInvites(accessToken: string) {
  return authenticatedRequest<ReceivedWorkspaceInvite[]>(
    "/team/invites/received",
    accessToken
  );
}

export function getAccessibleWorkspaces(accessToken: string) {
  return authenticatedRequest<WorkspaceAccess[]>("/team/workspaces", accessToken);
}

export function createWorkspaceInvite(
  accessToken: string,
  input: { email: string; role: Exclude<WorkspaceRole, "OWNER"> }
) {
  return authenticatedRequest<WorkspaceInvite>("/team/invites", accessToken, {
    method: "POST",
    body: input
  });
}

export function acceptWorkspaceInvite(accessToken: string, inviteId: string) {
  return authenticatedRequest<WorkspaceMember>(
    `/team/invites/${inviteId}/accept`,
    accessToken,
    { method: "POST" }
  );
}

export function cancelWorkspaceInvite(accessToken: string, inviteId: string) {
  return authenticatedRequest<WorkspaceInvite>(
    `/team/invites/${inviteId}/cancel`,
    accessToken,
    { method: "POST" }
  );
}

export function removeWorkspaceMember(accessToken: string, memberId: string) {
  return authenticatedRequest<{ deleted: boolean }>(`/team/members/${memberId}`, accessToken, {
    method: "DELETE"
  });
}

export function getNotificationHistory(accessToken: string) {
  return authenticatedRequest<NotificationHistoryItem[]>(
    "/notifications/history",
    accessToken
  );
}

export function getAuditLogs(accessToken: string) {
  return authenticatedRequest<AuditLogItem[]>("/audit-logs", accessToken);
}

export function testEmailNotification(accessToken: string) {
  return authenticatedRequest<NotificationHistoryItem>(
    "/notifications/email/test",
    accessToken,
    { method: "POST" }
  );
}

export function createWebhookEndpoint(
  accessToken: string,
  input: { name: string; url: string }
) {
  return authenticatedRequest<WebhookEndpoint>("/notifications/webhooks", accessToken, {
    method: "POST",
    body: input
  });
}

export function updateWebhookEndpoint(
  accessToken: string,
  webhookId: string,
  input: { name?: string; url?: string; isActive?: boolean }
) {
  return authenticatedRequest<WebhookEndpoint>(
    `/notifications/webhooks/${webhookId}`,
    accessToken,
    {
      method: "PATCH",
      body: input
    }
  );
}

export function deleteWebhookEndpoint(accessToken: string, webhookId: string) {
  return authenticatedRequest<{ deleted: boolean }>(
    `/notifications/webhooks/${webhookId}`,
    accessToken,
    { method: "DELETE" }
  );
}

export function testWebhookEndpoint(accessToken: string, webhookId: string) {
  return authenticatedRequest<NotificationHistoryItem>(
    `/notifications/webhooks/${webhookId}/test`,
    accessToken,
    { method: "POST" }
  );
}

export function rotateWebhookSecret(accessToken: string, webhookId: string) {
  return authenticatedRequest<WebhookEndpoint>(
    `/notifications/webhooks/${webhookId}/rotate-secret`,
    accessToken,
    { method: "POST" }
  );
}

export function subscribeToRealtime(
  accessToken: string,
  handlers: RealtimeHandlers
) {
  const url = new URL(`${API_BASE_URL}/realtime/events`);
  url.searchParams.set("token", accessToken);
  const workspaceOwnerId = getActiveWorkspaceOwnerId();

  if (workspaceOwnerId) {
    url.searchParams.set("workspaceOwnerId", workspaceOwnerId);
  }

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
  const workspaceOwnerId = getActiveWorkspaceOwnerId();

  if (workspaceOwnerId) {
    headers["X-PulseOps-Workspace-Owner-Id"] = workspaceOwnerId;
  }

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
