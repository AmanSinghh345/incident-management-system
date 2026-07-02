"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PublicStatusIncident,
  PublicStatusMonitor,
  PublicStatusPage,
  PublicStatusValue,
  getPublicStatus
} from "../../../lib/status";

export default function PublicStatusPageRoute() {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;
  const [statusPage, setStatusPage] = useState<PublicStatusPage | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        setError("");
        const nextStatusPage = await getPublicStatus(workspaceSlug);

        if (isMounted) {
          setStatusPage(nextStatusPage);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load status page."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();
    const intervalId = window.setInterval(() => void loadStatus(), 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [workspaceSlug]);

  const incidentCountText = useMemo(() => {
    const count = statusPage?.summary.openIncidents ?? 0;
    return count === 1 ? "1 active incident" : `${count} active incidents`;
  }, [statusPage]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-signal">
            PulseOps Status
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ink">
                {statusPage?.workspace.name ?? "Status page"}
              </h1>
              <p className="mt-2 text-slate-600">
                Public service health for {workspaceSlug}
              </p>
            </div>
            <Link
              className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            Loading status...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-alert/20 bg-red-50 p-6 text-alert">
            {error}
          </div>
        ) : statusPage ? (
          <>
            <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <StatusPill status={statusPage.summary.status} />
                  <h2 className="mt-4 text-2xl font-semibold text-ink">
                    {statusLabel(statusPage.summary.status)}
                  </h2>
                  <p className="mt-2 text-slate-600">{incidentCountText}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <SummaryStat
                    label="Services"
                    value={statusPage.summary.totalMonitors}
                  />
                  <SummaryStat
                    label="Active"
                    value={statusPage.summary.activeMonitors}
                  />
                  <SummaryStat
                    label="Incidents"
                    value={statusPage.summary.openIncidents}
                  />
                </div>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Last refreshed {new Date(statusPage.generatedAt).toLocaleString()}
              </p>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">Services</h2>
                <p className="text-sm text-slate-500">
                  Refreshes every 30 seconds
                </p>
              </div>

              {statusPage.monitors.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No public services are configured yet.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {statusPage.monitors.map((monitor) => (
                    <MonitorRow key={monitor.id} monitor={monitor} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold text-ink">Active incidents</h2>
              {statusPage.incidents.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No active incidents.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {statusPage.incidents.map((incident) => (
                    <IncidentCard incident={incident} key={incident.id} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">
                  Recent incidents
                </h2>
                <p className="text-sm text-slate-500">Latest 10</p>
              </div>
              {statusPage.recentIncidents.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No incidents reported.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {statusPage.recentIncidents.map((incident) => (
                    <IncidentCard incident={incident} key={incident.id} />
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

function IncidentCard({ incident }: { incident: PublicStatusIncident }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-ink">{incident.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {incident.monitor.name}
            {incident.monitor.url ? ` · ${incident.monitor.url}` : ""} · Started{" "}
            {new Date(incident.startedAt).toLocaleString()}
            {incident.resolvedAt
              ? ` · Resolved ${new Date(incident.resolvedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IncidentStatusBadge status={incident.status} />
          <IncidentSeverityBadge severity={incident.severity} />
        </div>
      </div>
      {incident.updates[0] ? (
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {incident.updates[0].message}
        </p>
      ) : null}
    </article>
  );
}

function IncidentStatusBadge({
  status
}: {
  status: PublicStatusIncident["status"];
}) {
  const classNameByStatus = {
    OPEN: "border-red-200 bg-red-50 text-alert",
    ACKNOWLEDGED: "border-amber-200 bg-amber-50 text-amber-700",
    RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };

  return (
    <span
      className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {status}
    </span>
  );
}

function IncidentSeverityBadge({
  severity
}: {
  severity: PublicStatusIncident["severity"];
}) {
  const classNameBySeverity = {
    LOW: "border-slate-200 bg-slate-100 text-slate-600",
    MEDIUM: "border-sky-200 bg-sky-50 text-sky-700",
    HIGH: "border-amber-200 bg-amber-50 text-amber-700",
    CRITICAL: "border-red-200 bg-red-50 text-alert"
  };

  return (
    <span
      className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${classNameBySeverity[severity]}`}
    >
      {severity}
    </span>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function MonitorRow({ monitor }: { monitor: PublicStatusMonitor }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center">
      <div className="min-w-0 md:col-span-4">
        <p className="font-semibold text-ink">{monitor.name}</p>
        <p className="truncate text-sm text-slate-500">
          {monitor.url ?? "URL hidden"}
        </p>
      </div>
      <div className="md:col-span-2">
        <ServiceStatusBadge status={monitor.isActive ? monitor.status : "PAUSED"} />
      </div>
      <div className="text-sm text-slate-600 md:col-span-2">
        <p className="font-medium text-ink">
          {formatPercent(monitor.uptime.last24h.uptimePercentage)}
        </p>
        <p className="text-xs text-slate-500">24h uptime</p>
      </div>
      <div className="text-sm text-slate-600 md:col-span-2">
        <p className="font-medium text-ink">
          {formatPercent(monitor.uptime.last7d.uptimePercentage)}
        </p>
        <p className="text-xs text-slate-500">7d uptime</p>
      </div>
      <p className="text-sm text-slate-600 md:col-span-2">
        {monitor.uptime.last24h.averageResponseTimeMs
          ? `${monitor.uptime.last24h.averageResponseTimeMs} ms avg`
          : "--"}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: PublicStatusValue }) {
  const classNameByStatus = {
    OPERATIONAL: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PARTIAL_OUTAGE: "border-amber-200 bg-amber-50 text-amber-700",
    MAJOR_OUTAGE: "border-red-200 bg-red-50 text-alert",
    PAUSED: "border-slate-200 bg-slate-100 text-slate-600",
    NO_MONITORS: "border-slate-200 bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function ServiceStatusBadge({ status }: { status: PublicStatusMonitor["status"] }) {
  const classNameByStatus = {
    UP: "border-emerald-200 bg-emerald-50 text-emerald-700",
    DOWN: "border-red-200 bg-red-50 text-alert",
    DEGRADED: "border-amber-200 bg-amber-50 text-amber-700",
    PAUSED: "border-slate-200 bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {status}
    </span>
  );
}

function statusLabel(status: PublicStatusValue) {
  const labelByStatus = {
    OPERATIONAL: "All systems operational",
    PARTIAL_OUTAGE: "Partial outage",
    MAJOR_OUTAGE: "Major outage",
    PAUSED: "Monitoring paused",
    NO_MONITORS: "No services configured"
  };

  return labelByStatus[status];
}

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value.toFixed(2)}%`;
}
