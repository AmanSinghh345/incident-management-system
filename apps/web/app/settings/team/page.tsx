"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ReceivedWorkspaceInvite,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  createWorkspaceInvite,
  getAccessToken,
  getReceivedWorkspaceInvites,
  getTeamMembers,
  getWorkspaceInvites,
  removeWorkspaceMember
} from "../../../lib/auth";

export default function TeamSettingsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<ReceivedWorkspaceInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "OWNER">>("MEMBER");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    void loadTeam(token);
  }, [router]);

  async function loadTeam(token = accessToken) {
    try {
      setError("");
      setIsLoading(true);
      const [memberList, inviteList, receivedInviteList] = await Promise.all([
        getTeamMembers(token),
        getWorkspaceInvites(token),
        getReceivedWorkspaceInvites(token)
      ]);
      setMembers(memberList);
      setInvites(inviteList);
      setReceivedInvites(receivedInviteList);
    } catch (caughtError) {
      setError(readError(caughtError, "Could not load team settings."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }

    try {
      setIsInviting(true);
      await createWorkspaceInvite(accessToken, {
        email: email.trim(),
        role
      });
      setEmail("");
      setRole("MEMBER");
      setSuccess("Invite created.");
      await loadTeam();
    } catch (caughtError) {
      setError(readError(caughtError, "Could not create invite."));
    } finally {
      setIsInviting(false);
    }
  }

  async function handleAccept(invite: ReceivedWorkspaceInvite) {
    await runAction(invite.id, async () => {
      await acceptWorkspaceInvite(accessToken, invite.id);
      setSuccess(`Joined ${invite.workspaceOwner.workspaceSlug}.`);
    });
  }

  async function handleCancel(invite: WorkspaceInvite) {
    await runAction(invite.id, async () => {
      await cancelWorkspaceInvite(accessToken, invite.id);
      setSuccess("Invite cancelled.");
    });
  }

  async function handleRemove(member: WorkspaceMember) {
    const confirmed = window.confirm(`Remove ${member.user.name} from the team?`);

    if (!confirmed) {
      return;
    }

    await runAction(member.id, async () => {
      await removeWorkspaceMember(accessToken, member.id);
      setSuccess("Member removed.");
    });
  }

  async function runAction(id: string, action: () => Promise<void>) {
    try {
      setError("");
      setSuccess("");
      setBusyId(id);
      await action();
      await loadTeam();
    } catch (caughtError) {
      setError(readError(caughtError, "Team action failed."));
    } finally {
      setBusyId("");
    }
  }

  const pendingInvites = invites.filter((invite) => invite.status === "PENDING");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              PulseOps
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">Team</h1>
            <p className="mt-2 text-slate-600">
              Invite teammates and assign incident ownership.
            </p>
          </div>
          <Link
            className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink"
            href="/dashboard"
          >
            Dashboard
          </Link>
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

        <form
          className="mt-8 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-12"
          onSubmit={handleInvite}
        >
          <div className="md:col-span-6">
            <label className="text-sm font-medium text-ink" htmlFor="email">
              Invite email
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={email}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm font-medium text-ink" htmlFor="role">
              Role
            </label>
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              id="role"
              onChange={(event) =>
                setRole(event.target.value as Exclude<WorkspaceRole, "OWNER">)
              }
              value={role}
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex items-end md:col-span-3">
            <button
              className="w-full rounded-md bg-signal px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isInviting}
              type="submit"
            >
              {isInviting ? "Inviting..." : "Invite"}
            </button>
          </div>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">Members</h2>
              <p className="text-sm text-slate-500">{members.length} total</p>
            </div>
            {isLoading ? (
              <EmptyState text="Loading members..." />
            ) : members.length === 0 ? (
              <EmptyState text="No members yet." />
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {members.map((member) => (
                  <div
                    className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center"
                    key={member.id}
                  >
                    <div className="min-w-0 md:col-span-7">
                      <p className="font-semibold text-ink">{member.user.name}</p>
                      <p className="truncate text-sm text-slate-500">
                        {member.user.email}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <RoleBadge role={member.role} />
                    </div>
                    <div className="md:col-span-3 md:text-right">
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-alert disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={busyId === member.id || member.role === "OWNER"}
                        onClick={() => void handleRemove(member)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">Pending invites</h2>
              <p className="text-sm text-slate-500">{pendingInvites.length} open</p>
            </div>
            {isLoading ? (
              <EmptyState text="Loading invites..." />
            ) : pendingInvites.length === 0 ? (
              <EmptyState text="No pending invites." />
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {pendingInvites.map((invite) => (
                  <div
                    className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center"
                    key={invite.id}
                  >
                    <div className="min-w-0 md:col-span-7">
                      <p className="truncate font-semibold text-ink">{invite.email}</p>
                      <p className="text-sm text-slate-500">
                        Created {new Date(invite.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <RoleBadge role={invite.role} />
                    </div>
                    <div className="md:col-span-3 md:text-right">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={busyId === invite.id}
                        onClick={() => void handleCancel(invite)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Invites for you</h2>
            <p className="text-sm text-slate-500">{receivedInvites.length} pending</p>
          </div>
          {isLoading ? (
            <EmptyState text="Loading received invites..." />
          ) : receivedInvites.length === 0 ? (
            <EmptyState text="No invites waiting for this account." />
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {receivedInvites.map((invite) => (
                <div
                  className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-12 md:items-center"
                  key={invite.id}
                >
                  <div className="min-w-0 md:col-span-8">
                    <p className="font-semibold text-ink">
                      {invite.workspaceOwner.name}'s workspace
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {invite.workspaceOwner.workspaceSlug} - {invite.workspaceOwner.email}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <RoleBadge role={invite.role} />
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <button
                      className="rounded-md bg-signal px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={busyId === invite.id}
                      onClick={() => void handleAccept(invite)}
                      type="button"
                    >
                      Accept
                    </button>
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

function RoleBadge({ role }: { role: WorkspaceRole }) {
  const classNameByRole = {
    OWNER: "border-signal/20 bg-blue-50 text-signal",
    ADMIN: "border-amber-200 bg-amber-50 text-amber-700",
    MEMBER: "border-slate-200 bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classNameByRole[role]}`}
    >
      {role}
    </span>
  );
}

function readError(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
