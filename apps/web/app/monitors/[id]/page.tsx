"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckResult,
  IncidentSummary,
  MonitorDetail,
  MonitorMethod,
  MonitorStats,
  MonitorStatsBucket,
  getAccessToken,
  getMonitor,
  getMonitorCheckResults,
  getMonitorStats,
  runMonitorCheck,
  subscribeToRealtime,
  updateMonitor
} from "../../../lib/auth";

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const monitorId = params.id;
  const [accessToken, setAccessToken] = useState("");
  const [monitor, setMonitor] = useState<MonitorDetail | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editMethod, setEditMethod] = useState<MonitorMethod>("GET");
  const [editExpectedStatusCode, setEditExpectedStatusCode] = useState(200);
  const [editTimeoutSeconds, setEditTimeoutSeconds] = useState(5);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editPublicName, setEditPublicName] = useState("");
  const [editShowUrl, setEditShowUrl] = useState(false);
  const [editIntervalSeconds, setEditIntervalSeconds] = useState(60);
  const [editFailureThreshold, setEditFailureThreshold] = useState(2);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadMonitor(token);

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (
          eventType === "monitor.changed" ||
          eventType === "check.created" ||
          eventType === "incident.changed"
        ) {
          void loadMonitor(token, { silent: true });
        }
      }
    });
  }, [monitorId, router]);

  const latestCheck = checkResults[0] ?? monitor?.checkResults[0];
  const activeIncidents = useMemo(
    () =>
      (monitor?.incidents ?? []).filter(
        (incident) => incident.status !== "RESOLVED"
      ),
    [monitor]
  );

  async function loadMonitor(
    token = accessToken,
    options: { silent?: boolean } = {}
  ) {
    try {
      setError("");
      if (!options.silent) {
        setIsLoading(true);
      }
      const [monitorDetail, history, monitorStats] = await Promise.all([
        getMonitor(token, monitorId),
        getMonitorCheckResults(token, monitorId),
        getMonitorStats(token, monitorId)
      ]);
      setMonitor(monitorDetail);
      setCheckResults(history);
      setStats(monitorStats);
      setEditName(monitorDetail.name);
      setEditUrl(monitorDetail.url);
      setEditMethod(monitorDetail.method);
      setEditExpectedStatusCode(monitorDetail.expectedStatusCode);
      setEditTimeoutSeconds(monitorDetail.timeoutSeconds);
      setEditIsPublic(monitorDetail.isPublic);
      setEditPublicName(monitorDetail.publicName ?? "");
      setEditShowUrl(monitorDetail.showUrl);
      setEditIntervalSeconds(monitorDetail.intervalSeconds);
      setEditFailureThreshold(monitorDetail.failureThreshold);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load monitor."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunCheck() {
    try {
      setError("");
      setSuccess("");
      setIsChecking(true);
      await runMonitorCheck(accessToken, monitorId);
      setSuccess("Check completed.");
      await loadMonitor();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not run check."));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!editName.trim() || !editUrl.trim()) {
      setError("Enter a monitor name and URL.");
      return;
    }

    if (editIntervalSeconds < 30) {
      setError("Interval must be at least 30 seconds.");
      return;
    }

    if (editExpectedStatusCode < 100 || editExpectedStatusCode > 599) {
      setError("Expected status code must be between 100 and 599.");
      return;
    }

    if (editTimeoutSeconds < 1 || editTimeoutSeconds > 60) {
      setError("Timeout must be between 1 and 60 seconds.");
      return;
    }

    if (editFailureThreshold < 1) {
      setError("Failure threshold must be at least 1.");
      return;
    }

    try {
      setIsSaving(true);
      await updateMonitor(accessToken, monitorId, {
        name: editName.trim(),
        url: editUrl.trim(),
        method: editMethod,
        expectedStatusCode: editExpectedStatusCode,
        timeoutSeconds: editTimeoutSeconds,
        isPublic: editIsPublic,
        publicName: editPublicName.trim(),
        showUrl: editShowUrl,
        intervalSeconds: editIntervalSeconds,
        failureThreshold: editFailureThreshold
      });
      setSuccess("Monitor settings saved.");
      await loadMonitor();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not save monitor settings."));
    } finally {
      setIsSaving(false);
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
              {monitor?.name ?? "Monitor"}
            </h1>
            <p className="mt-2 text-slate-600">
              {monitor?.url ?? "Loading monitor..."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/monitors"
            >
              Monitors
            </Link>
            <button
              className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isChecking || !monitor?.isActive}
              onClick={() => void handleRunCheck()}
              type="button"
            >
              {isChecking ? "Checking..." : "Run Check"}
            </button>
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
            Loading monitor...
          </div>
        ) : monitor ? (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <Metric label="Status" value={monitor.status} />
              <Metric
                label="Latest check"
                value={latestCheck?.status ?? "NONE"}
              />
              <Metric
                label="Response"
                value={
                  latestCheck?.responseTimeMs
                    ? `${latestCheck.responseTimeMs} ms`
                    : "--"
                }
              />
              <Metric label="Active incidents" value={activeIncidents.length} />
            </div>

            {stats ? (
              <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Analytics</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Last updated {new Date(stats.window.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">Last 24 hours by hour</p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <Metric
                    label="24h uptime"
                    value={formatPercent(stats.last24h.uptimePercentage)}
                  />
                  <Metric
                    label="7d uptime"
                    value={formatPercent(stats.last7d.uptimePercentage)}
                  />
                  <Metric
                    label="Avg response"
                    value={formatMs(stats.last24h.averageResponseTimeMs)}
                  />
                  <Metric
                    label="24h failures"
                    value={`${stats.last24h.failedChecks}/${stats.last24h.totalChecks}`}
                  />
                </div>

                <HourlyTimeline buckets={stats.hourlyTimeline} />
              </section>
            ) : null}

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">Settings</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <Setting label="Method" value={monitor.method} />
                  <Setting
                    label="Public"
                    value={monitor.isPublic ? "Shown" : "Hidden"}
                  />
                  <Setting
                    label="Public name"
                    value={monitor.publicName ?? monitor.name}
                  />
                  <Setting label="Public URL" value={monitor.showUrl ? "Shown" : "Hidden"} />
                  <Setting
                    label="Expected status"
                    value={String(monitor.expectedStatusCode)}
                  />
                  <Setting label="Timeout" value={`${monitor.timeoutSeconds}s`} />
                  <Setting label="Interval" value={`${monitor.intervalSeconds}s`} />
                  <Setting
                    label="Failure threshold"
                    value={String(monitor.failureThreshold)}
                  />
                  <Setting label="Active" value={monitor.isActive ? "Yes" : "No"} />
                  <Setting
                    label="Created"
                    value={new Date(monitor.createdAt).toLocaleString()}
                  />
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-ink">Edit settings</h2>
                <form
                  className="mt-4 grid gap-4 md:grid-cols-2"
                  onSubmit={handleSaveSettings}
                >
                  <div>
                    <label className="text-sm font-medium text-ink" htmlFor="name">
                      Name
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="name"
                      onChange={(event) => setEditName(event.target.value)}
                      value={editName}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-ink" htmlFor="url">
                      URL
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="url"
                      onChange={(event) => setEditUrl(event.target.value)}
                      type="url"
                      value={editUrl}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="method"
                    >
                      Method
                    </label>
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="method"
                      onChange={(event) =>
                        setEditMethod(event.target.value as MonitorMethod)
                      }
                      value={editMethod}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="HEAD">HEAD</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="expected"
                    >
                      Expected status
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="expected"
                      max={599}
                      min={100}
                      onChange={(event) =>
                        setEditExpectedStatusCode(Number(event.target.value))
                      }
                      type="number"
                      value={editExpectedStatusCode}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="timeout"
                    >
                      Timeout seconds
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="timeout"
                      max={60}
                      min={1}
                      onChange={(event) =>
                        setEditTimeoutSeconds(Number(event.target.value))
                      }
                      type="number"
                      value={editTimeoutSeconds}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="publicName"
                    >
                      Public name
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="publicName"
                      onChange={(event) => setEditPublicName(event.target.value)}
                      value={editPublicName}
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-ink">
                      <input
                        checked={editIsPublic}
                        onChange={(event) => setEditIsPublic(event.target.checked)}
                        type="checkbox"
                      />
                      Status page
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-ink">
                      <input
                        checked={editShowUrl}
                        disabled={!editIsPublic}
                        onChange={(event) => setEditShowUrl(event.target.checked)}
                        type="checkbox"
                      />
                      Show URL
                    </label>
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="interval"
                    >
                      Interval seconds
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="interval"
                      min={30}
                      onChange={(event) =>
                        setEditIntervalSeconds(Number(event.target.value))
                      }
                      type="number"
                      value={editIntervalSeconds}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium text-ink"
                      htmlFor="threshold"
                    >
                      Failure threshold
                    </label>
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      id="threshold"
                      min={1}
                      onChange={(event) =>
                        setEditFailureThreshold(Number(event.target.value))
                      }
                      type="number"
                      value={editFailureThreshold}
                    />
                  </div>
                  <div className="flex gap-2 md:col-span-2">
                    <button
                      className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? "Saving..." : "Save settings"}
                    </button>
                    <button
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
                      onClick={() => {
                        setEditName(monitor.name);
                        setEditUrl(monitor.url);
                        setEditMethod(monitor.method);
                        setEditExpectedStatusCode(monitor.expectedStatusCode);
                        setEditTimeoutSeconds(monitor.timeoutSeconds);
                        setEditIsPublic(monitor.isPublic);
                        setEditPublicName(monitor.publicName ?? "");
                        setEditShowUrl(monitor.showUrl);
                        setEditIntervalSeconds(monitor.intervalSeconds);
                        setEditFailureThreshold(monitor.failureThreshold);
                      }}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ink">Related incidents</h2>
                  <Link
                    className="text-sm font-semibold text-signal"
                    href="/incidents"
                  >
                    View all
                  </Link>
                </div>
                {monitor.incidents.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No related incidents.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {monitor.incidents.map((incident) => (
                      <IncidentRow incident={incident} key={incident.id} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">Check history</h2>
                <p className="text-sm text-slate-500">
                  {checkResults.length} results
                </p>
              </div>
              {checkResults.length === 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
                  No checks recorded.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span className="col-span-3">Status</span>
                    <span className="col-span-2">Code</span>
                    <span className="col-span-2">Response</span>
                    <span className="col-span-3">Checked</span>
                    <span className="col-span-2">Error</span>
                  </div>
                  {checkResults.map((result) => (
                    <div
                      className="grid grid-cols-12 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0"
                      key={result.id}
                    >
                      <span className="col-span-3 font-semibold text-ink">
                        {result.status}
                      </span>
                      <span className="col-span-2 text-slate-600">
                        {result.statusCode ?? "--"}
                      </span>
                      <span className="col-span-2 text-slate-600">
                        {result.responseTimeMs ? `${result.responseTimeMs} ms` : "--"}
                      </span>
                      <span className="col-span-3 text-slate-600">
                        {new Date(result.checkedAt).toLocaleString()}
                      </span>
                      <span className="col-span-2 truncate text-slate-500">
                        {result.errorMessage ?? "--"}
                      </span>
                    </div>
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-4 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function IncidentRow({ incident }: { incident: IncidentSummary }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">{incident.title}</p>
        <span className="text-xs font-semibold text-slate-500">
          {incident.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Started {new Date(incident.startedAt).toLocaleString()}
      </p>
    </div>
  );
}

function HourlyTimeline({ buckets }: { buckets: MonitorStatsBucket[] }) {
  const visibleBuckets = buckets.filter((bucket) => bucket.totalChecks > 0);

  if (visibleBuckets.length === 0) {
    return (
      <div className="mt-5 rounded-md bg-slate-100 p-4 text-sm text-slate-600">
        No checks in the last 24 hours.
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex h-28 items-end gap-1 rounded-md bg-slate-100 p-3">
        {buckets.map((bucket) => {
          const uptime = bucket.uptimePercentage ?? 0;
          const height = bucket.totalChecks === 0 ? 8 : Math.max(12, uptime);
          const statusClass =
            bucket.totalChecks === 0
              ? "bg-slate-300"
              : bucket.failedChecks > 0
                ? "bg-alert"
                : "bg-emerald-500";

          return (
            <div
              className="flex flex-1 items-end"
              key={bucket.start}
              title={`${new Date(bucket.start).toLocaleTimeString()} - ${formatPercent(
                bucket.uptimePercentage
              )}`}
            >
              <div
                className={`w-full rounded-sm ${statusClass}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{new Date(buckets[0]?.start ?? Date.now()).toLocaleTimeString()}</span>
        <span>Now</span>
      </div>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value.toFixed(2)}%`;
}

function formatMs(value: number | null) {
  return value === null ? "--" : `${value} ms`;
}

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
