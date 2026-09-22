"use client";

import { useActionState, useState } from "react";
import { saveProject, type ProjectActionResult } from "@/app/projects/actions";
import {
  PROJECT_HOURS_PER_WEEK,
  PROJECT_LESSONS_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_OUTCOMES,
  PROJECT_ROLE_MAX_LENGTH,
} from "@/lib/project-options";
import type { Project } from "@/lib/projects";
import { m } from "@/lib/messages";

const initialState: ProjectActionResult = { ok: false, message: "" };

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

// Add or edit a project. `project` is set only when editing (its links are managed separately,
// once it exists). `onSaved` closes the form and refreshes the list.
export function ProjectForm({
  project,
  categories,
  onSaved,
  onCancel,
}: {
  project?: Project;
  categories: { id: number; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (previous: ProjectActionResult, formData: FormData) => {
    const result = await saveProject(previous, formData);
    if (result.ok) onSaved();
    return result;
  }, initialState);
  const [outcome, setOutcome] = useState(project?.outcome ?? "");
  const ongoing = outcome === "ongoing";
  const errors = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="text-lg font-semibold tracking-tight">
        {project ? m.projects.formTitleEdit : m.projects.formTitleNew}
      </h3>
      {project && <input type="hidden" name="project_id" value={project.id} />}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.nameLabel}
        <input
          name="name"
          defaultValue={project?.name}
          maxLength={PROJECT_NAME_MAX_LENGTH}
          placeholder={m.projects.namePlaceholder}
          className={inputClass + " font-normal"}
        />
        {errors.name && <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.name}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.categoryLabel}
        <select
          name="category_id"
          defaultValue={project ? String(project.categoryId) : ""}
          className={inputClass + " font-normal"}
        >
          <option value="" disabled>
            {m.projects.categoryPlaceholder}
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.category_id && (
          <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.category_id}</span>
        )}
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {m.projects.startedLabel}
          <input
            type="month"
            name="started_on"
            defaultValue={project?.startedOn.slice(0, 7)}
            className={inputClass + " font-normal"}
          />
          {errors.started_on && (
            <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.started_on}</span>
          )}
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {m.projects.endedLabel}
          <input
            type="month"
            name="ended_on"
            disabled={ongoing}
            defaultValue={project?.endedOn?.slice(0, 7)}
            className={inputClass + " font-normal disabled:opacity-50"}
          />
          {errors.ended_on && (
            <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.ended_on}</span>
          )}
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.roleLabel}
        <input
          name="role"
          defaultValue={project?.role ?? ""}
          maxLength={PROJECT_ROLE_MAX_LENGTH}
          placeholder={m.projects.rolePlaceholder}
          className={inputClass + " font-normal"}
        />
        {errors.role && <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.role}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.hoursLabel}
        <select name="hours_per_week" defaultValue={project?.hoursPerWeek ?? ""} className={inputClass + " font-normal"}>
          <option value="">{m.projects.hoursPlaceholder}</option>
          {PROJECT_HOURS_PER_WEEK.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.outcomeLabel}
        <select
          name="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          className={inputClass + " font-normal"}
        >
          <option value="" disabled>
            {m.projects.outcomePlaceholder}
          </option>
          {PROJECT_OUTCOMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.outcome && <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.outcome}</span>}
        {ongoing && <span className="text-sm font-normal text-zinc-500">{m.projects.ongoingLabel}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.lessonsLabel}
        <textarea
          name="lessons"
          defaultValue={project?.lessons}
          maxLength={PROJECT_LESSONS_MAX_LENGTH}
          rows={4}
          placeholder={m.projects.lessonsPlaceholder}
          className="rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        {errors.lessons && <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.lessons}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.projects.siretLabel}
        <input name="siret" defaultValue={project?.siret ?? ""} inputMode="numeric" className={inputClass + " font-normal"} />
        <span className="text-sm font-normal text-zinc-500">{m.projects.siretHint}</span>
        {errors.siret && <span className="text-sm font-normal text-red-600 dark:text-red-400">{errors.siret}</span>}
      </label>

      {!state.ok && state.message && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? m.projects.saveBusy : m.projects.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.projects.cancel}
        </button>
      </div>
    </form>
  );
}
