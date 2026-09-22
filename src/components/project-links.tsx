"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectLink, removeProjectLink } from "@/app/projects/actions";
import { PROJECT_LINK_LABEL_MAX_LENGTH, PROJECT_MAX_LINKS } from "@/lib/project-options";
import type { ProjectLink } from "@/lib/projects";
import { m } from "@/lib/messages";

function RemoveButton({ linkId }: { linkId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function remove() {
    setError(null);
    startBusy(async () => {
      const result = await removeProjectLink(linkId);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={remove} disabled={busy} className="text-xs text-zinc-500 underline disabled:opacity-60">
        {busy ? m.projects.links.removeBusy : m.projects.links.remove}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Evidence links for one project: a website, a press mention, anything https://. Only shown
// once the project already exists (a new one is saved first, then you can add links to it).
export function ProjectLinks({ projectId, links }: { projectId: string; links: ProjectLink[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startBusy(async () => {
      const result = await addProjectLink({ projectId, label, url });
      if (result.ok) {
        setLabel("");
        setUrl("");
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">{m.projects.links.title}</h4>
      <p className="text-sm text-zinc-500">{m.projects.links.hint}</p>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-500">{m.projects.links.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={m.projects.links.openLink(link.label)}
                className="min-w-0 flex-1 truncate font-medium underline"
              >
                {link.label}
              </a>
              <RemoveButton linkId={link.id} />
            </li>
          ))}
        </ul>
      )}

      {links.length < PROJECT_MAX_LINKS ? (
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={PROJECT_LINK_LABEL_MAX_LENGTH}
            placeholder={m.projects.links.labelPlaceholder}
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={m.projects.links.urlPlaceholder}
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
          />
          <button
            type="submit"
            disabled={busy || label.trim() === "" || url.trim() === ""}
            className="h-11 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
          >
            {busy ? m.projects.links.adding : m.projects.links.add}
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">{m.projects.links.limitReached}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
