"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLink, removeLink } from "@/app/journeys/actions";
import { JOURNEY_LINK_KINDS, JOURNEY_LINK_TITLE_MAX_LENGTH, type JourneyLinkKind } from "@/lib/journey-options";
import type { JourneyLink } from "@/lib/journeys";
import { m } from "@/lib/messages";

function RemoveButton({ journeyId, linkId }: { journeyId: string; linkId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function remove() {
    setError(null);
    startBusy(async () => {
      const result = await removeLink(journeyId, linkId);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={remove} disabled={busy} className="text-xs text-zinc-500 underline disabled:opacity-60">
        {busy ? m.parcours.removeLinkBusy : m.parcours.removeLink}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// "Nos outils": the shared links of a parcours. Links open in a new tab; the address always
// starts with https:// (checked here, in the server action and by the database).
export function JourneyLinks({
  journeyId,
  links,
  canAdd,
}: {
  journeyId: string;
  links: JourneyLink[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<JourneyLinkKind>("other");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startBusy(async () => {
      const result = await addLink({ journeyId, title, url, kind });
      if (result.ok) {
        setTitle("");
        setUrl("");
        setKind("other");
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{m.parcours.toolsTitle}</h2>
      <p className="text-sm text-zinc-500">{m.parcours.toolsHint}</p>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {m.parcours.toolsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={m.parcours.openLink(link.title)}
                  className="block truncate font-medium underline"
                >
                  {link.title}
                </a>
                <p className="truncate text-xs text-zinc-500">
                  {m.parcours.kinds[link.kind]}
                  {link.addedByName ? ` · ${m.parcours.addedBy(link.addedByName)}` : ""}
                </p>
              </div>
              {link.canRemove && canAdd && <RemoveButton journeyId={journeyId} linkId={link.id} />}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">{m.parcours.addLinkTitle}</h3>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {m.parcours.linkKindLabel}
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as JourneyLinkKind)}
              className="h-12 rounded-xl border border-zinc-300 bg-transparent px-3 text-base font-normal dark:border-zinc-700"
            >
              {JOURNEY_LINK_KINDS.map((value) => (
                <option key={value} value={value}>
                  {m.parcours.kinds[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {m.parcours.linkTitleLabel}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={JOURNEY_LINK_TITLE_MAX_LENGTH}
              placeholder={m.parcours.linkTitlePlaceholder}
              className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {m.parcours.linkUrlLabel}
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={m.parcours.linkUrlPlaceholder}
              className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || title.trim() === "" || url.trim() === ""}
            className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
          >
            {busy ? m.parcours.linkAdding : m.parcours.linkAdd}
          </button>
        </form>
      )}
    </section>
  );
}
