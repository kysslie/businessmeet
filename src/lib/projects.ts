import { m } from "@/lib/messages";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ProjectLink = { id: number; label: string; url: string };

export type Project = {
  id: string;
  name: string;
  categoryId: number;
  categoryName: string;
  startedOn: string;
  endedOn: string | null;
  role: string | null;
  hoursPerWeek: string | null;
  outcome: string;
  lessons: string;
  siret: string | null;
  visibility: "public" | "private";
  links: ProjectLink[];
};

const PROJECT_COLUMNS =
  "id, name, category_id, started_on, ended_on, role, hours_per_week, outcome, lessons, siret, visibility, categories(name), project_links(id, label, url)";

// All of the logged-in person's own projects, newest start date first. Row level security
// already limits this to their own rows.
export async function loadMyProjects(supabase: Supabase, userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("owner_id", userId)
    .order("started_on", { ascending: false });
  if (error) throw new Error(m.projects.errors.loadFailed);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? m.projects.categoryPlaceholder,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    role: row.role,
    hoursPerWeek: row.hours_per_week,
    outcome: row.outcome,
    lessons: row.lessons,
    siret: row.siret,
    visibility: row.visibility as "public" | "private",
    links: (row.project_links ?? []).map((link) => ({ id: link.id, label: link.label, url: link.url })),
  }));
}
