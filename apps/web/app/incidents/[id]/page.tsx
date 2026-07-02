"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  IncidentDetail,
  IncidentSeverity,
  IncidentStatus,
  WorkspaceMember,
  acknowledgeIncident,
  addIncidentUpdate,
  assignIncidentToMember,
  assignIncidentToMe,
  getAccessToken,
  getIncident,
  getTeamMembers,
  resolveIncident,
  subscribeToRealtime,
  updateIncidentSeverity,
  unassignIncident
} from "../../../lib/auth";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const incidentId = params.id;
  const [accessToken, setAccessToken] = useState("");
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [teamMembers, setTeamMembers] = useState<WorkspaceMember[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isChangingSeverity, setIsChangingSeverity] = useState(false);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadIncident(token);
    void loadTeamMembers(token);

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (eventType === "incident.changed" || eventType === "check.created") {
          void loadIncident(token, { silent: true });
        }
      }
    });
  }, [incidentId, router]);

  async function loadIncident(
    token = accessToken,
    options: { silent?: boolean } = {}
  ) {
    try {
      setError("");
      if (!options.silent) {
        setIsLoading(true);
      }
      const incidentDetail = await getIncident(token, incidentId);
      setIncident(incidentDetail);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load incident."));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTeamMembers(token = accessToken) {
    try {
      const memberList = await getTeamMembers(token);
      setTeamMembers(memberList);
    } catch {
      setTeamMembers([]);
    }
  }

  async function handleAcknowledge() {
    await runStatusAction(async () => {
      await acknowledgeIncident(accessToken, incidentId);
      setSuccess("Incident acknowledged.");
    });
  }

  async function handleResolve() {
    await runStatusAction(async () => {
      await resolveIncident(accessToken, incidentId);
      setSuccess("Incident resolved.");
    });
  }

  async function handleAssignToMe() {
    await runStatusAction(async () => {
      await assignIncidentToMe(accessToken, incidentId);
      setSuccess("Incident assigned.");
    });
  }

  async function handleAssignToMember(userId: string) {
    if (!userId) {
      await handleUnassign();
      return;
    }

    await runStatusAction(async () => {
      await assignIncidentToMember(accessToken, incidentId, userId);
      setSuccess("Incident assigned.");
    });
  }

  async function handleUnassign() {
    await runStatusAction(async () => {
      await unassignIncident(accessToken, incidentId);
      setSuccess("Incident unassigned.");
    });
  }

  async function handleSeverityChange(severity: IncidentSeverity) {
    try {
      setError("");
      setSuccess("");
      setIsChangingSeverity(true);
      await updateIncidentSeverity(accessToken, incidentId, severity);
      setSuccess("Severity updated.");
      await loadIncident();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not update severity."));
    } finally {
      setIsChangingSeverity(false);
    }
  }

  async function runStatusAction(action: () => Promise<void>) {
    try {
      setError("");
      setSuccess("");
      setIsChangingStatus(true);
      await action();
      await loadIncident();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not update incident."));
    } finally {
      setIsChangingStatus(false);
    }
  }

  async function handleAddUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!message.trim()) {
      setError("Write an update message first.");
      return;
    }

    try {
      setIsSavingUpdate(true);
      await addIncidentUpdate(accessToken, incidentId, message.trim());
      setMessage("");
      setSuccess("Update added.");
      await loadIncident();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not add update."));
    } finally {
      setIsSavingUpdate(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              PulseOps
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">
              {incident?.title ?? "Incident"}
            </h1>
            <p className="mt-2 text-slate-600">
              {incident
                ? `${incident.monitor.name} · ${incident.monitor.url}`
                : "Loading incident..."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/incidents"
            >
              Incidents
            </Link>
            {incident ? (
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
                href={`/monitors/${incident.monitor.id}`}
              >
                Monitor
              </Link>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-alert/20 bg-red-50 p-4 text-sm text-alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            Loading incident...
          </div>
        ) : incident ? (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-5">
              <Metric label="Incident status" value={incident.status} />
              <Metric label="Severity" value={incident.severity} />
              <Metric
                label="Assigned to"
                value={incident.assignedTo?.name ?? "Unassigned"}
              />
              <Metric label="Monitor status" value={incident.monitor.status} />
              <Metric
                label="Started"
                value={new Date(incident.startedAt).toLocaleString()}
              />
              <Metric
                label="Resolved"
                value={
                  incident.resolvedAt
                    ? new Date(incident.resolvedAt).toLocaleString()
                    : "Not resolved"
                }
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-ink">Status</h2>
                  <div className="flex flex-wrap gap-2">
                    <IncidentStatusBadge status={incident.status} />
                    <IncidentSeverityBadge severity={incident.severity} />
                  </div>
                </div>
                <div className="mt-5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="severity"
                  >
                    Severity
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                    disabled={isChangingSeverity}
                    id="severity"
                    onChange={(event) =>
                      void handleSeverityChange(
                        event.target.value as IncidentSeverity
                      )
                    }
                    value={incident.severity}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div className="mt-5">
                  <label
                    className="text-sm font-medium text-ink"
                    htmlFor="assignedTo"
                  >
                    Assignee
                  </label>
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                    disabled={isChangingStatus || incident.status === "RESOLVED"}
                    id="assignedTo"
                    onChange={(event) =>
                      void handleAssignToMember(event.target.value)
                    }
                    value={incident.assignedTo?.id ?? ""}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.userId}>
                        {member.user.name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isChangingStatus || incident.status !== "OPEN"}
                    onClick={() => void handleAcknowledge()}
                    type="button"
                  >
                    Acknowledge
                  </button>
                  <button
                    className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isChangingStatus || incident.status === "RESOLVED"}
                    onClick={() => void handleResolve()}
                    type="button"
                  >
                    Resolve
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isChangingStatus || incident.status === "RESOLVED"}
                    onClick={() =>
                      incident.assignedTo
                        ? void handleUnassign()
                        : void handleAssignToMe()
                    }
                    type="button"
                  >
                    {incident.assignedTo ? "Unassign" : "Assign to me"}
                  </button>
                </div>
                <dl className="mt-6 space-y-3 text-sm">
                  <Setting label="Monitor" value={incident.monitor.name} />
                  <Setting label="Severity" value={incident.severity} />
                  <Setting
                    label="Assigned to"
                    value={incident.assignedTo?.name ?? "Unassigned"}
                  />
                  <Setting label="URL" value={incident.monitor.url} />
                  <Setting
                    label="Updates"
                    value={String(incident.updates.length)}
                  />
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-ink">Add timeline update</h2>
                <form className="mt-4" onSubmit={handleAddUpdate}>
                  <textarea
                    className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    maxLength={1000}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Investigating the API health endpoint..."
                    value={message}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {message.length}/1000
                    </p>
                    <button
                      className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isSavingUpdate}
                      type="submit"
                    >
                      {isSavingUpdate ? "Adding..." : "Add update"}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">Timeline</h2>
                <p className="text-sm text-slate-500">
                  {incident.updates.length} updates
                </p>
              </div>

              {incident.updates.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No timeline updates yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {incident.updates.map((update) => (
                    <article
                      className="rounded-lg border border-slate-200 bg-white p-5"
                      key={update.id}
                    >
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-semibold text-ink">
                          {update.author?.name ?? "System"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(update.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                        {update.message}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-4 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-all text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const classNameByStatus = {
    OPEN: "border-red-200 bg-red-50 text-alert",
    ACKNOWLEDGED: "border-amber-200 bg-amber-50 text-amber-700",
    RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {status}
    </span>
  );
}

function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const classNameBySeverity = {
    LOW: "border-slate-200 bg-slate-100 text-slate-600",
    MEDIUM: "border-sky-200 bg-sky-50 text-sky-700",
    HIGH: "border-amber-200 bg-amber-50 text-amber-700",
    CRITICAL: "border-red-200 bg-red-50 text-alert"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameBySeverity[severity]}`}
    >
      {severity}
    </span>
  );
}

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
