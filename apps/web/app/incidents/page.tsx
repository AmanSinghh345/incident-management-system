"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IncidentListItem,
  acknowledgeIncident,
  assignIncidentToMe,
  getAccessToken,
  getIncidents,
  resolveIncident,
  subscribeToRealtime,
  unassignIncident
} from "../../lib/auth";

export default function IncidentsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyIncidentId, setBusyIncidentId] = useState("");

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadIncidents(token);

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (eventType === "incident.changed" || eventType === "check.created") {
          void loadIncidents(token, { silent: true });
        }
      }
    });
  }, [router]);

  const sortedIncidents = useMemo(() => {
    const statusRank = {
      OPEN: 0,
      ACKNOWLEDGED: 1,
      RESOLVED: 2
    };

  return [...incidents].sort((left, right) => {
      const severityRank = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3
      };
      const statusDifference = statusRank[left.status] - statusRank[right.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const severityDifference =
        severityRank[left.severity] - severityRank[right.severity];

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return (
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
      );
    });
  }, [incidents]);

  const activeCount = incidents.filter(
    (incident) => incident.status !== "RESOLVED"
  ).length;

  async function loadIncidents(
    token = accessToken,
    options: { silent?: boolean } = {}
  ) {
    try {
      setError("");
      if (!options.silent) {
        setIsLoading(true);
      }
      const incidentList = await getIncidents(token);
      setIncidents(incidentList);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load incidents."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAcknowledge(incident: IncidentListItem) {
    await runIncidentAction(incident.id, async () => {
      await acknowledgeIncident(accessToken, incident.id);
      setSuccess("Incident acknowledged.");
    });
  }

  async function handleResolve(incident: IncidentListItem) {
    await runIncidentAction(incident.id, async () => {
      await resolveIncident(accessToken, incident.id);
      setSuccess("Incident resolved.");
    });
  }

  async function handleAssignToMe(incident: IncidentListItem) {
    await runIncidentAction(incident.id, async () => {
      await assignIncidentToMe(accessToken, incident.id);
      setSuccess("Incident assigned.");
    });
  }

  async function handleUnassign(incident: IncidentListItem) {
    await runIncidentAction(incident.id, async () => {
      await unassignIncident(accessToken, incident.id);
      setSuccess("Incident unassigned.");
    });
  }

  async function runIncidentAction(
    incidentId: string,
    action: () => Promise<void>
  ) {
    try {
      setError("");
      setSuccess("");
      setBusyIncidentId(incidentId);
      await action();
      await loadIncidents();
    } catch (caughtError) {
      setError(readError(caughtError, "Incident action failed."));
    } finally {
      setBusyIncidentId("");
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
            <h1 className="mt-2 text-3xl font-bold text-ink">Incidents</h1>
            <p className="mt-2 text-slate-600">
              Review outages, acknowledge active work, and resolve recovered services.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white"
              href="/monitors"
            >
              Monitors
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Metric label="Active incidents" value={activeCount} />
          <Metric label="Total incidents" value={incidents.length} />
          <Metric
            label="Resolved"
            value={incidents.filter((incident) => incident.status === "RESOLVED").length}
          />
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

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Incident queue</h2>
            <p className="text-sm text-slate-500">Active first</p>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              Loading incidents...
            </div>
          ) : sortedIncidents.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No incidents yet.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {sortedIncidents.map((incident) => {
                const isBusy = busyIncidentId === incident.id;
                const latestUpdate = incident.updates.at(-1);

                return (
                  <article
                    className="rounded-lg border border-slate-200 bg-white p-5"
                    key={incident.id}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="text-lg font-semibold text-ink hover:text-signal"
                            href={`/incidents/${incident.id}`}
                          >
                            {incident.title}
                          </Link>
                          <IncidentStatusBadge status={incident.status} />
                          <IncidentSeverityBadge severity={incident.severity} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {incident.monitor.name} · {incident.monitor.url}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Started {new Date(incident.startedAt).toLocaleString()}
                          {incident.resolvedAt
                            ? ` · Resolved ${new Date(
                                incident.resolvedAt
                              ).toLocaleString()}`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Assigned to {incident.assignedTo?.name ?? "Unassigned"}
                        </p>
                        {latestUpdate ? (
                          <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                            {latestUpdate.message}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => router.push(`/incidents/${incident.id}`)}
                          type="button"
                        >
                          View
                        </button>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy || incident.status !== "OPEN"}
                          onClick={() => void handleAcknowledge(incident)}
                          type="button"
                        >
                          Acknowledge
                        </button>
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy || incident.status === "RESOLVED"}
                          onClick={() =>
                            incident.assignedTo
                              ? void handleUnassign(incident)
                              : void handleAssignToMe(incident)
                          }
                          type="button"
                        >
                          {incident.assignedTo ? "Unassign" : "Assign"}
                        </button>
                        <button
                          className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBusy || incident.status === "RESOLVED"}
                          onClick={() => void handleResolve(incident)}
                          type="button"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function IncidentStatusBadge({ status }: { status: IncidentListItem["status"] }) {
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

function IncidentSeverityBadge({
  severity
}: {
  severity: IncidentListItem["severity"];
}) {
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
