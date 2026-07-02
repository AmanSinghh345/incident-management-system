"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  NotificationHistoryItem,
  WebhookEndpoint,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getAccessToken,
  getNotificationHistory,
  getWebhookEndpoints,
  rotateWebhookSecret,
  testEmailNotification,
  testWebhookEndpoint,
  updateWebhookEndpoint
} from "../../../lib/auth";

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [busyWebhookId, setBusyWebhookId] = useState("");
  const [visibleSecretId, setVisibleSecretId] = useState("");

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadSettings(token);
  }, [router]);

  async function loadSettings(token = accessToken) {
    try {
      setError("");
      setIsLoading(true);
      const [webhookList, historyList] = await Promise.all([
        getWebhookEndpoints(token),
        getNotificationHistory(token)
      ]);
      setWebhooks(webhookList);
      setHistory(historyList);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load notification settings."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !url.trim()) {
      setError("Enter a webhook name and URL.");
      return;
    }

    try {
      setIsCreating(true);
      await createWebhookEndpoint(accessToken, {
        name: name.trim(),
        url: url.trim()
      });
      setName("");
      setUrl("");
      setSuccess("Webhook created.");
      await loadSettings();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not create webhook."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(webhook: WebhookEndpoint) {
    await runWebhookAction(webhook.id, async () => {
      await updateWebhookEndpoint(accessToken, webhook.id, {
        isActive: !webhook.isActive
      });
      setSuccess(webhook.isActive ? "Webhook paused." : "Webhook resumed.");
    });
  }

  async function handleTest(webhook: WebhookEndpoint) {
    await runWebhookAction(webhook.id, async () => {
      await testWebhookEndpoint(accessToken, webhook.id);
      setSuccess("Test webhook sent.");
    });
  }

  async function handleTestEmail() {
    try {
      setError("");
      setSuccess("");
      setIsTestingEmail(true);
      await testEmailNotification(accessToken);
      setSuccess("Test email attempted. Check delivery history for the result.");
      await loadSettings();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not send test email."));
    } finally {
      setIsTestingEmail(false);
    }
  }

  async function handleRotateSecret(webhook: WebhookEndpoint) {
    const confirmed = window.confirm(`Rotate secret for ${webhook.name}?`);

    if (!confirmed) {
      return;
    }

    await runWebhookAction(webhook.id, async () => {
      await rotateWebhookSecret(accessToken, webhook.id);
      setVisibleSecretId(webhook.id);
      setSuccess("Webhook secret rotated.");
    });
  }

  async function handleDelete(webhook: WebhookEndpoint) {
    const confirmed = window.confirm(`Delete ${webhook.name}?`);

    if (!confirmed) {
      return;
    }

    await runWebhookAction(webhook.id, async () => {
      await deleteWebhookEndpoint(accessToken, webhook.id);
      setSuccess("Webhook deleted.");
    });
  }

  async function runWebhookAction(
    webhookId: string,
    action: () => Promise<void>
  ) {
    try {
      setError("");
      setSuccess("");
      setBusyWebhookId(webhookId);
      await action();
      await loadSettings();
    } catch (caughtError) {
      setError(readError(caughtError, "Webhook action failed."));
    } finally {
      setBusyWebhookId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              PulseOps
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">Notifications</h1>
            <p className="mt-2 text-slate-600">
              Send webhook alerts when incidents open or resolve.
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
          <div className="md:col-span-4">
            <label className="text-sm font-medium text-ink" htmlFor="name">
              Name
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Incident webhook"
              value={name}
            />
          </div>
          <div className="md:col-span-6">
            <label className="text-sm font-medium text-ink" htmlFor="url">
              Webhook URL
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/webhook"
              type="url"
              value={url}
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <button
              className="w-full rounded-md bg-signal px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "Adding..." : "Add"}
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

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Email alerts</h2>
              <p className="mt-1 text-sm text-slate-600">
                Incident opened and resolved emails use Resend when email
                environment variables are configured.
              </p>
            </div>
            <button
              className="w-fit rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isTestingEmail}
              onClick={() => void handleTestEmail()}
              type="button"
            >
              {isTestingEmail ? "Sending..." : "Test Email"}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Webhook endpoints</h2>
            <p className="text-sm text-slate-500">{webhooks.length} total</p>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              Loading webhooks...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No webhooks configured.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {webhooks.map((webhook) => {
                const isBusy = busyWebhookId === webhook.id;

                return (
                  <div
                    className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center"
                    key={webhook.id}
                  >
                    <div className="min-w-0 md:col-span-4">
                      <p className="font-semibold text-ink">{webhook.name}</p>
                      <p className="truncate text-sm text-slate-500">
                        {webhook.url}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        {visibleSecretId === webhook.id
                          ? webhook.secret
                          : maskSecret(webhook.secret)}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <WebhookBadge isActive={webhook.isActive} />
                    </div>
                    <p className="text-sm text-slate-600 md:col-span-3">
                      Created {new Date(webhook.createdAt).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-2 md:col-span-3 md:justify-end">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void handleToggle(webhook)}
                        type="button"
                      >
                        {webhook.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy || !webhook.isActive}
                        onClick={() => void handleTest(webhook)}
                        type="button"
                      >
                        Test
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() =>
                          setVisibleSecretId(
                            visibleSecretId === webhook.id ? "" : webhook.id
                          )
                        }
                        type="button"
                      >
                        {visibleSecretId === webhook.id ? "Hide" : "Secret"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void handleRotateSecret(webhook)}
                        type="button"
                      >
                        Rotate
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-alert disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => void handleDelete(webhook)}
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

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Delivery history</h2>
            <p className="text-sm text-slate-500">Latest 50 attempts</p>
          </div>

          {isLoading ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No delivery attempts yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="col-span-2">Status</span>
                <span className="col-span-3">Event</span>
                <span className="col-span-3">Recipient</span>
                <span className="col-span-2">Incident</span>
                <span className="col-span-2">Created</span>
              </div>
              {history.map((item) => (
                <div
                  className="grid grid-cols-12 gap-2 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0"
                  key={item.id}
                >
                  <div className="col-span-2">
                    <NotificationStatusBadge status={item.status} />
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="font-semibold text-ink">{item.subject}</p>
                    <p className="truncate text-xs text-slate-500">
                      {item.channel} - {item.message}
                    </p>
                  </div>
                  <p className="col-span-3 truncate text-slate-600">
                    {item.recipient}
                  </p>
                  <p className="col-span-2 truncate text-slate-600">
                    {item.incident?.title ?? "--"}
                  </p>
                  <p className="col-span-2 text-slate-600">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function WebhookBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {isActive ? "ACTIVE" : "PAUSED"}
    </span>
  );
}

function NotificationStatusBadge({
  status
}: {
  status: NotificationHistoryItem["status"];
}) {
  const classNameByStatus = {
    PENDING: "border-slate-200 bg-slate-100 text-slate-600",
    SENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
    FAILED: "border-red-200 bg-red-50 text-alert"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameByStatus[status]}`}
    >
      {status}
    </span>
  );
}

function maskSecret(secret: string) {
  if (secret.length <= 12) {
    return "********";
  }

  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
