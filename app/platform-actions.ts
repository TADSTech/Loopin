"use server";

import { randomBytes } from "node:crypto";

import { generateApiKey } from "@/lib/api-keys";
import { generateWebhookSecret, isSsrfSafeTarget, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { createClient } from "@/lib/supabase/server";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  role: string;
  memberCount: number;
};

function slugify(input: string): string {
  const base =
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "event";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// API & Webhooks
// ---------------------------------------------------------------------------

/** Creates an API key. The plaintext key is returned once and never stored. */
export async function createApiKey(
  name: string,
): Promise<{ key: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  const { key, prefix, hash } = generateApiKey();
  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    name: name.trim() || "Default",
    prefix,
    key_hash: hash,
  });

  if (error) return { error: error.message };
  return { key };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data } = await supabase
    .from("api_keys")
    .select("id, name, prefix, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as ApiKeyRow[];
}

export async function revokeApiKey(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return error ? { error: error.message } : { ok: true };
}

/** Registers a webhook. Returns the signing secret once. */
export async function createWebhook(
  url: string,
  events: string[],
): Promise<{ secret: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  if (!/^https?:\/\//i.test(url)) return { error: "invalid_url" };
  // Block loopback / RFC1918 / cloud-metadata targets at registration time so a
  // webhook can never be aimed at internal infrastructure later.
  if (!isSsrfSafeTarget(url.trim())) return { error: "invalid_url" };
  const valid = events.filter((event) =>
    (WEBHOOK_EVENTS as readonly string[]).includes(event),
  );

  const secret = generateWebhookSecret();
  const { error } = await supabase.from("webhooks").insert({
    user_id: user.id,
    url: url.trim(),
    secret,
    events: valid.length ? valid : ["extraction.completed"],
  });

  if (error) return { error: error.message };
  return { secret };
}

export async function listWebhooks(): Promise<WebhookRow[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data } = await supabase
    .from("webhooks")
    .select("id, url, events, active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as WebhookRow[];
}

export async function deleteWebhook(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return error ? { error: error.message } : { ok: true };
}

// ---------------------------------------------------------------------------
// Shared Calendars
// ---------------------------------------------------------------------------

export async function createWorkspace(
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };
  if (!name.trim()) return { error: "invalid_name" };

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: name.trim(), owner_id: user.id })
    .select("id")
    .single();

  if (error || !workspace) return { error: error?.message ?? "failed" };

  await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  return { ok: true };
}

export async function listWorkspaces(): Promise<WorkspaceRow[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, owner_id")
    .order("created_at", { ascending: false });

  if (!workspaces) return [];

  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role");

  return workspaces.map((workspace) => {
    const mine = (members ?? []).find(
      (m) => m.workspace_id === workspace.id && m.user_id === user.id,
    );
    return {
      id: workspace.id,
      name: workspace.name,
      owner_id: workspace.owner_id,
      role: mine?.role ?? "member",
      memberCount: (members ?? []).filter(
        (m) => m.workspace_id === workspace.id,
      ).length,
    };
  });
}

export async function addWorkspaceMember(
  workspaceId: string,
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (!profile) return { error: "no_such_user" };

  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: profile.id,
    role: "member",
  });

  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public Event Pages
// ---------------------------------------------------------------------------

export async function publishEvent(event: {
  title: string;
  start: string;
  end?: string | null;
  location?: string;
  notes?: string;
}): Promise<{ path: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };
  if (!event.title?.trim()) return { error: "invalid_event" };

  const slug = slugify(event.title);

  const { error } = await supabase.from("event_pages").insert({
    user_id: user.id,
    slug,
    title: event.title.trim(),
    start: event.start ?? null,
    end: event.end ?? null,
    location: event.location ?? null,
    notes: event.notes ?? null,
    is_public: true,
  });

  if (error) return { error: error.message };
  return { path: `/e/${slug}` };
}

// ---------------------------------------------------------------------------
// Smart Reminders
// ---------------------------------------------------------------------------

export async function scheduleReminder(
  event: { title: string; start: string },
  minutesBefore = 30,
): Promise<{ sendAt: string } | { error: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "auth_required" };

  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return { error: "invalid_start" };

  const sendAt = new Date(start.getTime() - minutesBefore * 60 * 1000);
  if (sendAt.getTime() < Date.now()) return { error: "too_late" };

  const { error } = await supabase.from("reminders").insert({
    user_id: user.id,
    event_title: event.title,
    event_start: start.toISOString(),
    send_at: sendAt.toISOString(),
    channel: "email",
    status: "pending",
  });

  if (error) return { error: error.message };
  return { sendAt: sendAt.toISOString() };
}
