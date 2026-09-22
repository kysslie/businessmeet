// Server-only, secret-key operations. NEVER import this from client code.
//
// This does a plain fetch against Supabase's admin REST API rather than instantiating the
// full @supabase/supabase-js client with the secret key: that client always tries to set up a
// realtime (WebSocket) connection, which crashes on plain Node 20 ("no native WebSocket
// support", see the F6 note in CLAUDE.md) even though account deletion never uses realtime.
// A direct fetch avoids that entirely and needs no new dependency.
function adminHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export type AdminResult = { ok: true } | { ok: false; status: number; message: string };

// Permanently deletes the auth user. Every foreign key pointing at a user is ON DELETE CASCADE,
// so this also removes their profile, projects, links, swipes, matches, messages, blocks and
// reports. It does NOT remove their Storage files (Storage isn't part of the Postgres cascade),
// see removeAllAvatarFiles.
export async function adminDeleteUser(userId: string): Promise<AdminResult> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, { method: "DELETE", headers: adminHeaders() });
  if (res.ok) return { ok: true };
  const message = await res.text().catch(() => "");
  return { ok: false, status: res.status, message: message.slice(0, 300) };
}
