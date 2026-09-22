"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/app/projects/actions";
import { PROJECT_OUTCOMES } from "@/lib/project-options";
import type { Project } from "@/lib/projects";
import { m } from "@/lib/messages";
import { ProjectForm } from "@/components/project-form";
import { ProjectLinks } from "@/components/project-links";

function outcomeLabel(value: string) {
  return PROJECT_OUTCOMES.find((option) => option.value === value)?.label ?? value;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(m.locale, {
    month: "short",
    year: "numeric",
  });
}

function DeleteButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function confirm() {
    setError(null);
    startBusy(async () => {
      const result = await deleteProject(projectId);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm text-zinc-500 underline">
        {m.projects.delete}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800" role="alertdialog">
      <p className="text-sm">{m.projects.deleteAsk}</p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="h-9 flex-1 rounded-xl bg-foreground px-3 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? m.projects.deleteBusy : m.projects.deleteConfirm}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="h-9 flex-1 rounded-xl border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
        >
          {m.projects.deleteCancel}
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const range = project.endedOn
    ? `${monthLabel(project.startedOn)} – ${monthLabel(project.endedOn)}`
    : `${monthLabel(project.startedOn)} – ${m.projects.outcomes.ongoing}`;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight">{project.name}</p>
          <p className="text-sm text-zinc-500">
            {project.categoryName} · {range} · {outcomeLabel(project.outcome)}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="shrink-0 text-sm underline">
          {m.projects.edit}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{project.lessons}</p>
      {project.links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {project.links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={m.projects.links.openLink(link.label)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs underline dark:border-zinc-700"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div>
        <DeleteButton projectId={project.id} />
      </div>
    </li>
  );
}

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; id: string };

// "Mes projets": the whole section on the profile page. List, add, edit and delete, plus the
// links of whichever project is being edited.
export function ProjectList({
  projects,
  categories,
}: {
  projects: Project[];
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  function close() {
    setMode({ kind: "list" });
    router.refresh();
  }

  const editing = mode.kind === "edit" ? projects.find((project) => project.id === mode.id) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{m.projects.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{m.projects.intro}</p>
      </div>

      {projects.length === 0 && mode.kind === "list" && (
        <div className="rounded-2xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <p className="text-sm font-medium">{m.projects.empty}</p>
          <p className="mt-1 text-sm text-zinc-500">{m.projects.emptyHint}</p>
        </div>
      )}

      {mode.kind === "list" && projects.length > 0 && (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={() => setMode({ kind: "edit", id: project.id })} />
          ))}
        </ul>
      )}

      {mode.kind === "add" && (
        <ProjectForm categories={categories} onSaved={close} onCancel={() => setMode({ kind: "list" })} />
      )}

      {mode.kind === "edit" && editing && (
        <div className="flex flex-col gap-4">
          <ProjectForm project={editing} categories={categories} onSaved={close} onCancel={() => setMode({ kind: "list" })} />
          <ProjectLinks projectId={editing.id} links={editing.links} />
        </div>
      )}

      {mode.kind === "list" && (
        <button
          type="button"
          onClick={() => setMode({ kind: "add" })}
          className="h-11 self-start rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.projects.add}
        </button>
      )}
    </section>
  );
}
