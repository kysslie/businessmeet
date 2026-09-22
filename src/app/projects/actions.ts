"use server";

import { revalidatePath } from "next/cache";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { projectIdSchema, projectLinkSchema, projectSchema } from "@/lib/validation/project";

export type ProjectActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

async function currentUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return { supabase, userId: auth?.claims?.sub ?? null };
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
}

// Creates a new project, or edits an existing one if `formData` carries a `project_id`. Row
// level security enforces ownership and that the category is active either way.
export async function saveProject(_previous: ProjectActionResult, formData: FormData): Promise<ProjectActionResult> {
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const text = (name: string) => String(formData.get(name) ?? "");
  const parsed = projectSchema.safeParse({
    name: text("name"),
    category_id: text("category_id"),
    started_on: text("started_on"),
    ended_on: text("ended_on"),
    role: text("role"),
    hours_per_week: text("hours_per_week"),
    outcome: text("outcome"),
    lessons: text("lessons"),
    siret: text("siret"),
    visibility: formData.get("visibility") === "public" ? "public" : "private",
  });
  if (!parsed.success) {
    return { ok: false, message: m.projects.errors.saveFailed, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const projectId = text("project_id");
  const row = {
    name: parsed.data.name,
    category_id: parsed.data.category_id,
    started_on: parsed.data.started_on,
    ended_on: parsed.data.ended_on,
    role: parsed.data.role,
    hours_per_week: parsed.data.hours_per_week,
    outcome: parsed.data.outcome,
    lessons: parsed.data.lessons,
    siret: parsed.data.siret,
    visibility: parsed.data.visibility,
  };

  const { error } =
    projectId === ""
      ? await supabase.from("projects").insert({ ...row, owner_id: userId })
      : await supabase.from("projects").update(row).eq("id", projectId);

  if (error) {
    console.error("saveProject failed:", error.code, error.message);
    return { ok: false, message: m.projects.errors.saveFailed };
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<ProjectActionResult> {
  if (!projectIdSchema.safeParse(projectId).success) return { ok: false, message: m.projects.errors.deleteFailed };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("deleteProject failed:", error.code, error.message);
    return { ok: false, message: m.projects.errors.deleteFailed };
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function addProjectLink(input: {
  projectId: string;
  label: string;
  url: string;
}): Promise<ProjectActionResult> {
  const parsed = projectLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.from("project_links").insert({
    project_id: parsed.data.projectId,
    label: parsed.data.label,
    url: parsed.data.url,
  });
  if (error) {
    console.error("addProjectLink failed:", error.code, error.message);
    const message = error.message.includes("at most 5 links") ? m.projects.links.limitReached : m.projects.errors.linkAddFailed;
    return { ok: false, message };
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function removeProjectLink(linkId: number): Promise<ProjectActionResult> {
  if (!Number.isInteger(linkId)) return { ok: false, message: m.projects.errors.linkRemoveFailed };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase.from("project_links").delete().eq("id", linkId).select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("removeProjectLink failed:", error.code, error.message);
    return { ok: false, message: m.projects.errors.linkRemoveFailed };
  }
  revalidatePath("/profile");
  return { ok: true };
}
