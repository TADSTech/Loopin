"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  listApiKeys,
  listWebhooks,
  revokeApiKey,
  type ApiKeyRow,
  type WebhookRow,
} from "../platform-actions";
import { createClient } from "@/lib/supabase/client";

const fieldInput =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary focus:border-primary focus:ring-1 focus:ring-primary";

const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";

const ghostBtn =
  "inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted cursor-pointer";

export default function DevelopersPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [busy, setBusy] = useState(false);
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
    listApiKeys()
      .then(setKeys)
      .catch(() => {});
    listWebhooks()
      .then(setHooks)
      .catch(() => {});
  }, [session]);

  const handleCreateKey = async () => {
    setBusy(true);
    setError("");
    const result = await createApiKey(keyName);
    if ("key" in result) {
      setNewKey(result.key);
      setKeyName("");
      setKeys(await listApiKeys());
    } else {
      setError(result.error);
    }
    setBusy(false);
  };

  const handleRevoke = async (id: string) => {
    await revokeApiKey(id);
    setKeys(await listApiKeys());
  };

  const handleCreateHook = async () => {
    setBusy(true);
    setError("");
    const result = await createWebhook(hookUrl, ["extraction.completed"]);
    if ("secret" in result) {
      setNewSecret(result.secret);
      setHookUrl("");
      setHooks(await listWebhooks());
    } else {
      setError(result.error);
    }
    setBusy(false);
  };

  const handleDeleteHook = async (id: string) => {
    await deleteWebhook(id);
    setHooks(await listWebhooks());
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
              Developers
            </h1>
            <p className="mt-1 text-sm text-tertiary">
              Extract events programmatically and receive signed webhooks.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-error-soft px-3 py-2 text-xs text-error">
              {error}
            </p>
          )}

          {/* API keys */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              API keys
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                className={`${fieldInput} max-w-xs flex-1`}
                placeholder="Key name (e.g. Zapier)"
                aria-label="API key name"
              />
              <button
                type="button"
                onClick={handleCreateKey}
                disabled={busy}
                className={primaryBtn}
              >
                Create key
              </button>
            </div>

            {newKey && (
              <div className="mt-3 rounded-md border border-primary-border bg-primary-soft p-3">
                <p className="text-xs font-medium text-primary">
                  Copy this key now — it won&apos;t be shown again.
                </p>
                <code className="mt-1 block break-all text-xs text-foreground">
                  {newKey}
                </code>
              </div>
            )}

            {keys.length > 0 && (
              <ul className="mt-4 space-y-2">
                {keys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {key.name}
                      </p>
                      <p className="text-xs text-tertiary">
                        {key.prefix}… ·{" "}
                        {key.last_used_at ? "used" : "never used"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id)}
                      className="text-xs font-medium text-error hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Webhooks */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Webhooks
            </h2>
            <p className="mt-2 text-xs text-tertiary">
              Fires <code>extraction.completed</code> with an
              <code> X-Loopin-Signature</code> header for verification.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={hookUrl}
                onChange={(event) => setHookUrl(event.target.value)}
                className={`${fieldInput} max-w-xs flex-1`}
                placeholder="https://example.com/hooks/loopin"
                aria-label="Webhook URL"
              />
              <button
                type="button"
                onClick={handleCreateHook}
                disabled={busy}
                className={ghostBtn}
              >
                Add webhook
              </button>
            </div>

            {newSecret && (
              <div className="mt-3 rounded-md border border-primary-border bg-primary-soft p-3">
                <p className="text-xs font-medium text-primary">
                  Signing secret — store it securely.
                </p>
                <code className="mt-1 block break-all text-xs text-foreground">
                  {newSecret}
                </code>
              </div>
            )}

            {hooks.length > 0 && (
              <ul className="mt-4 space-y-2">
                {hooks.map((hook) => (
                  <li
                    key={hook.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="truncate text-sm text-foreground">
                      {hook.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteHook(hook.id)}
                      className="text-xs font-medium text-error hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Docs */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              API reference
            </h2>
            <p className="mt-2 text-sm text-foreground">
              <code>POST /api/v1/extract</code>
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-foreground">
              {`curl -X POST ${"https://loopin.tadstech.dev"}/api/v1/extract \\
  -H "Authorization: Bearer loop_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Team standup Friday 9am at the office","timezone":"Africa/Lagos"}'`}
            </pre>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-tertiary">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/workspaces"
              className="transition-colors hover:text-foreground"
            >
              Workspaces
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
