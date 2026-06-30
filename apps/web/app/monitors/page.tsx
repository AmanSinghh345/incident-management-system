"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  MonitorSummary,
  createMonitor,
  deleteMonitor,
  getAccessToken,
  getMonitors,
  runMonitorCheck,
  subscribeToRealtime,
  updateMonitorActiveState
} from "../../lib/auth";

export default function MonitorsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [failureThreshold, setFailureThreshold] = useState(2);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyMonitorId, setBusyMonitorId] = useState("");

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadMonitors(token);

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (
          eventType === "monitor.changed" ||
          eventType === "monitor.deleted" ||
          eventType === "check.created" ||
          eventType === "incident.changed"
        ) {
          void loadMonitors(token, { silent: true });
        }
      }
    });
  }, [router]);

  async function loadMonitors(
    token = accessToken,
    options: { silent?: boolean } = {}
  ) {
    try {
      setError("");
      if (!options.silent) {
        setIsLoading(true);
      }
      const monitorList = await getMonitors(token);
      setMonitors(monitorList);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load monitors."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !url.trim()) {
      setError("Enter a monitor name and URL.");
      return;
    }

    if (intervalSeconds < 30) {
      setError("Interval must be at least 30 seconds.");
      return;
    }

    if (failureThreshold < 1) {
      setError("Failure threshold must be at least 1.");
      return;
    }

    setIsCreating(true);

    try {
      await createMonitor(accessToken, {
        name: name.trim(),
        url: url.trim(),
        intervalSeconds,
        failureThreshold
      });
      setName("");
      setUrl("");
      setIntervalSeconds(60);
      setFailureThreshold(2);
      setSuccess("Monitor created.");
      await loadMonitors();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not create monitor."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRunCheck(monitorId: string) {
    await runMonitorAction(monitorId, async () => {
      await runMonitorCheck(accessToken, monitorId);
      setSuccess("Check completed.");
    });
  }

  async function handleToggleActive(monitor: MonitorSummary) {
    await runMonitorAction(monitor.id, async () => {
      await updateMonitorActiveState(accessToken, monitor.id, !monitor.isActive);
      setSuccess(monitor.isActive ? "Monitor paused." : "Monitor resumed.");
    });
  }

  async function handleDelete(monitor: MonitorSummary) {
    const confirmed = window.confirm(`Delete ${monitor.name}?`);

    if (!confirmed) {
      return;
    }

    await runMonitorAction(monitor.id, async () => {
      await deleteMonitor(accessToken, monitor.id);
      setSuccess("Monitor deleted.");
    });
  }

  async function runMonitorAction(
    monitorId: string,
    action: () => Promise<void>
  ) {
    try {
      setError("");
      setSuccess("");
      setBusyMonitorId(monitorId);
      await action();
      await loadMonitors();
    } catch (caughtError) {
      setError(readError(caughtError, "Monitor action failed."));
    } finally {
      setBusyMonitorId("");
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
            <h1 className="mt-2 text-3xl font-bold text-ink">Monitors</h1>
            <p className="mt-2 text-slate-600">
              Create monitors, run checks, and control active status.
            </p>
          </div>
          <Link
            className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>

        <form
          className="mt-8 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-12"
          onSubmit={handleCreate}
        >
          <div className="md:col-span-3">
            <label className="text-sm font-medium text-ink" htmlFor="name">
              Name
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Main API"
              value={name}
            />
          </div>
          <div className="md:col-span-4">
            <label className="text-sm font-medium text-ink" htmlFor="url">
              URL
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/health"
              type="url"
              value={url}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-ink" htmlFor="interval">
              Interval
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="interval"
              min={30}
              onChange={(event) => setIntervalSeconds(Number(event.target.value))}
              type="number"
              value={intervalSeconds}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-ink" htmlFor="threshold">
              Failures
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="threshold"
              min={1}
              onChange={(event) => setFailureThreshold(Number(event.target.value))}
              type="number"
              value={failureThreshold}
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              className="w-full rounded-md bg-signal px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "..." : "Add"}
            </button>
          </div>
        </form>

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
            <h2 className="text-xl font-semibold text-ink">All monitors</h2>
            <p className="text-sm text-slate-500">{monitors.length} total</p>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              Loading monitors...
            </div>
          ) : monitors.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No monitors yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {monitors.map((monitor) => {
                const latestCheck = monitor.checkResults[0];
                const isBusy = busyMonitorId === monitor.id;

                return (
                  <div
                    className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center"
                    key={monitor.id}
                  >
                    <div className="min-w-0 md:col-span-4">
                      <Link
                        className="font-semibold text-ink hover:text-signal"
                        href={`/monitors/${monitor.id}`}
                      >
                        {monitor.name}
                      </Link>
                      <p className="truncate text-sm text-slate-500">
                        {monitor.url}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <StatusBadge status={monitor.status} />
                    </div>
                    <div className="text-sm text-slate-600 md:col-span-2">
                      <p>
                        {latestCheck
                          ? `${latestCheck.status} ${latestCheck.statusCode ?? ""}`
                          : "No checks"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {latestCheck?.responseTimeMs
                          ? `${latestCheck.responseTimeMs} ms`
                          : "--"}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 md:col-span-1">
                      {monitor.incidents.length} incidents
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-3 md:justify-end">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => router.push(`/monitors/${monitor.id}`)}
                        type="button"
                      >
                        View
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy || !monitor.isActive}
                        onClick={() => void handleRunCheck(monitor.id)}
                        type="button"
                      >
                        Check
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void handleToggleActive(monitor)}
                        type="button"
                      >
                        {monitor.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-alert disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void handleDelete(monitor)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
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

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
