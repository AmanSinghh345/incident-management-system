"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AuditLogItem,
  getAccessToken,
  getAuditLogs,
  subscribeToRealtime
} from "../../../lib/auth";

export default function AuditLogPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadLogs(token);

    return subscribeToRealtime(token, {
      onEvent: (eventType) => {
        if (eventType !== "connected") {
          void loadLogs(token, { silent: true });
        }
      }
    });
  }, [router]);

  async function loadLogs(
    token = accessToken,
    options: { silent?: boolean } = {}
  ) {
    try {
      setError("");
      if (!options.silent) {
        setIsLoading(true);
      }
      const auditLogs = await getAuditLogs(token);
      setLogs(auditLogs);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load audit log."));
    } finally {
      setIsLoading(false);
    }
  }

  const groupedLogs = useMemo(() => {
    return logs.reduce<Record<string, AuditLogItem[]>>((groups, log) => {
      const date = new Date(log.createdAt).toLocaleDateString();
      groups[date] = groups[date] ?? [];
      groups[date].push(log);
      return groups;
    }, {});
  }, [logs]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              PulseOps
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">Audit log</h1>
            <p className="mt-2 text-slate-600">
              Review important workspace changes and who performed them.
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
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
              href="/settings/team"
            >
              Team
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-alert/20 bg-red-50 p-4 text-sm text-alert">
            {error}
          </div>
        ) : null}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Latest activity</h2>
            <p className="text-sm text-slate-500">{logs.length} events</p>
          </div>

          {isLoading ? (
            <EmptyState text="Loading audit log..." />
          ) : logs.length === 0 ? (
            <EmptyState text="No audit events yet." />
          ) : (
            <div className="mt-4 space-y-6">
              {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                <div key={date}>
                  <p className="mb-3 text-sm font-semibold text-slate-500">{date}</p>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {dateLogs.map((log) => (
                      <article
                        className="grid gap-4 border-b border-slate-100 p-4 text-sm last:border-b-0 md:grid-cols-12 md:items-start"
                        key={log.id}
                      >
                        <div className="md:col-span-2">
                          <ActionBadge action={log.action} />
                          <p className="mt-2 text-xs text-slate-500">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="min-w-0 md:col-span-5">
                          <p className="font-semibold text-ink">{log.summary}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {log.entityType}
                            {log.entityId ? ` - ${log.entityId}` : ""}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="font-medium text-ink">
                            {log.actor?.name ?? "System"}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {log.actor?.email ?? "Automated event"}
                          </p>
                        </div>
                        <pre className="max-h-28 overflow-auto rounded-md bg-slate-100 p-3 text-xs text-slate-600 md:col-span-3">
                          {formatMetadata(log.metadata)}
                        </pre>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
      {text}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone = action.includes("deleted") || action.includes("removed")
    ? "border-red-200 bg-red-50 text-alert"
    : action.includes("created") || action.includes("accepted")
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {action}
    </span>
  );
}

function formatMetadata(metadata: unknown) {
  if (!metadata) {
    return "{}";
  }

  return JSON.stringify(metadata, null, 2);
}

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
