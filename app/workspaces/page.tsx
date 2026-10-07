"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  addWorkspaceMember,
  createWorkspace,
  listWorkspaces,
  type WorkspaceRow,
} from "../platform-actions";
import { createClient } from "@/lib/supabase/client";

const fieldInput =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary focus:border-primary focus:ring-1 focus:ring-primary";

export default function WorkspacesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (!data.session) {
          router.replace("/");
          return;
        }
        setSession(data.session);
      })
      .catch(() => router.replace("/"));
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!session) return;
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => {});
  }, [session]);

  const handleCreate = async () => {
    setError("");
    setMessage("");
    const result = await createWorkspace(name);
    if ("ok" in result) {
      setName("");
      setWorkspaces(await listWorkspaces());
    } else {
      setError(result.error);
    }
  };

  const handleInvite = async () => {
    setError("");
    setMessage("");
    if (!targetId) {
      setError("Pick a workspace first.");
      return;
    }
    const result = await addWorkspaceMember(targetId, inviteEmail);
    if ("ok" in result) {
      setMessage(`Added ${inviteEmail}.`);
      setInviteEmail("");
      setWorkspaces(await listWorkspaces());
    } else {
      setError(
        result.error === "no_such_user"
          ? "No Loopin account with that email yet."
          : result.error,
      );
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/profile"
            className="flex h-10 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Back to profile
          </Link>
        </header>

        <div className="flex-1 space-y-5 py-6">
          <div>
            <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight text-foreground">
              Shared workspaces
            </h1>
            <p className="mt-1 text-sm text-tertiary">
              Group events and invite teammates by email.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-error-soft px-3 py-2 text-xs text-error">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-md bg-primary-soft px-3 py-2 text-xs text-primary">
              {message}
            </p>
          )}

          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Create a workspace
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`${fieldInput} max-w-xs flex-1`}
                placeholder="Workspace name (e.g. Ops team)"
                aria-label="Workspace name"
              />
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
              >
                Create
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Your workspaces
            </h2>
            {workspaces.length === 0 ? (
              <p className="mt-3 text-sm text-tertiary">No workspaces yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {workspaces.map((workspace) => (
                  <li
                    key={workspace.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-foreground">
                        {workspace.name}
                      </p>
                      <p className="text-xs text-tertiary">
                        {workspace.memberCount}{" "}
                        {workspace.memberCount === 1 ? "member" : "members"} ·{" "}
                        {workspace.role}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {workspaces.length > 0 && (
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
                Invite a teammate
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className={`${fieldInput} max-w-[12rem]`}
                  aria-label="Select workspace"
                >
                  <option value="">Select workspace…</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className={`${fieldInput} max-w-xs flex-1`}
                  placeholder="teammate@example.com"
                  aria-label="Teammate email"
                />
                <button
                  type="button"
                  onClick={handleInvite}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted cursor-pointer"
                >
                  Invite
                </button>
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-tertiary">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/developers"
              className="transition-colors hover:text-foreground"
            >
              Developers
            </Link>
            <Link
              href="/profile"
              className="transition-colors hover:text-foreground"
            >
              Profile
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
