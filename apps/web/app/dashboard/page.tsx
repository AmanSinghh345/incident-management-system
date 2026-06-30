"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AuthUser,
  MonitorSummary,
  clearAccessToken,
  getAccessToken,
  getCurrentUser,
  getMonitors,
  subscribeToRealtime
} from "../../lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const token = accessToken;

    async function loadDashboard(options: { silent?: boolean } = {}) {
      try {
        setError("");
        if (!options.silent) {
          setIsLoading(true);
        }
        const [currentUser, monitorList] = await Promise.all([
          getCurrentUser(token),
          getMonitors(token)
        ]);
        setUser(currentUser);
        setMonitors(monitorList);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load dashboard."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (eventType !== "connected") {
          void loadDashboard({ silent: true });
        }
      }
    });
  }, [router]);

  const metrics = useMemo(() => {
    const activeMonitors = monitors.filter((monitor) => monitor.isActive);
    const upMonitors = monitors.filter((monitor) => monitor.status === "UP");
    const downMonitors = monitors.filter((monitor) => monitor.status === "DOWN");
    const openIncidents = monitors.reduce(
      (count, monitor) => count + monitor.incidents.length,
      0
    );
    const latestChecks = monitors.filter(
      (monitor) => monitor.checkResults.length > 0
    ).length;

    return [
      {
        label: "Active monitors",
        value: activeMonitors.length,
        detail: `${monitors.length} total`
      },
      {
        label: "UP",
        value: upMonitors.length,
        detail: "Healthy monitors"
      },
      {
        label: "DOWN",
        value: downMonitors.length,
        detail: "Needs attention"
      },
      {
        label: "Open incidents",
        value: openIncidents,
        detail: "Across all monitors"
      },
      {
        label: "Recent checks",
        value: latestChecks,
        detail: "Monitors with results"
      }
    ];
  }, [monitors]);

  function handleLogout() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              PulseOps
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">Dashboard</h1>
            <p className="mt-2 text-slate-600">
              {user
                ? `${user.name}'s workspace: ${user.workspaceSlug}`
                : "Loading workspace..."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white"
              href="/monitors"
            >
              Add Monitor
            </Link>
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/incidents"
            >
              View Incidents
            </Link>
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              onClick={handleLogout}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            Loading dashboard...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-alert/20 bg-red-50 p-6 text-alert">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-5">
              {metrics.map((metric) => (
                <div
                  className="rounded-lg border border-slate-200 bg-white p-5"
                  key={metric.label}
                >
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  <p className="mt-4 text-3xl font-semibold text-ink">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
                </div>
              ))}
            </div>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">Monitors</h2>
                <Link className="text-sm font-semibold text-signal" href="/monitors">
                  Manage monitors
                </Link>
                <p className="hidden text-sm text-slate-500 md:block">
                  {monitors.length} configured
                </p>
              </div>

              {monitors.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No monitors yet.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span className="col-span-4">Name</span>
                    <span className="col-span-2">Status</span>
                    <span className="col-span-2">Last check</span>
                    <span className="col-span-2">Response</span>
                    <span className="col-span-2">Incidents</span>
                  </div>
                  {monitors.map((monitor) => {
                    const latestCheck = monitor.checkResults[0];

                    return (
                      <div
                        className="grid grid-cols-12 items-center border-b border-slate-100 px-4 py-4 text-sm last:border-b-0"
                        key={monitor.id}
                      >
                        <div className="col-span-4 min-w-0">
                          <p className="font-semibold text-ink">{monitor.name}</p>
                          <p className="truncate text-slate-500">{monitor.url}</p>
                        </div>
                        <div className="col-span-2">
                          <StatusBadge status={monitor.status} />
                        </div>
                        <p className="col-span-2 text-slate-600">
                          {latestCheck
                            ? new Date(latestCheck.checkedAt).toLocaleString()
                            : "Not checked"}
                        </p>
                        <p className="col-span-2 text-slate-600">
                          {latestCheck?.responseTimeMs
                            ? `${latestCheck.responseTimeMs} ms`
                            : "--"}
                        </p>
                        <p className="col-span-2 text-slate-600">
                          {monitor.incidents.length}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: MonitorSummary["status"] }) {
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
