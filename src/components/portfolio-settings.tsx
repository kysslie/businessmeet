"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePortfolioToggles } from "@/app/profile/actions";
import { m } from "@/lib/messages";
import type { PortfolioSettings as Settings } from "@/lib/portfolio";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-zinc-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
    </label>
  );
}

// "Votre page publique" on the profile: the open-to-partners and indexable toggles, the
// permanent link, and the view count. `visibility` itself lives in the main profile form.
// `url` is built server-side (from the request's own origin), not from `window`, so the
// server-rendered and hydrated markup always match.
export function PortfolioSettings({ settings, url }: { settings: Settings; url: string | null }) {
  const router = useRouter();
  const [openToPartners, setOpenToPartners] = useState(settings.openToPartners);
  const [searchIndexable, setSearchIndexable] = useState(settings.searchIndexable);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startPending] = useTransition();

  function save(next: { openToPartners?: boolean; searchIndexable?: boolean }) {
    const nextOpen = next.openToPartners ?? openToPartners;
    const nextIndexable = next.searchIndexable ?? searchIndexable;
    setOpenToPartners(nextOpen);
    setSearchIndexable(nextIndexable);
    setError(null);
    startPending(async () => {
      const result = await updatePortfolioToggles(nextOpen, nextIndexable);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(m.portfolio.saveFailed);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{m.portfolio.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{m.portfolio.intro}</p>
      </div>

      {url && (
        <div className="flex flex-wrap items-center gap-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm underline">
            {url}
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="h-9 shrink-0 rounded-xl border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
          >
            {copied ? m.portfolio.linkCopied : m.portfolio.copyLink}
          </button>
          <span className="text-sm text-zinc-500">{m.portfolio.views(settings.pageViews)}</span>
        </div>
      )}

      {settings.slug && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{m.portfolio.downloadCard}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/p/${settings.slug}/card-landscape.png`}
              download
              className="flex h-9 items-center rounded-xl border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
            >
              {m.portfolio.downloadLandscape}
            </a>
            <a
              href={`/p/${settings.slug}/card-square.png`}
              download
              className="flex h-9 items-center rounded-xl border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
            >
              {m.portfolio.downloadSquare}
            </a>
          </div>
        </div>
      )}

      <Toggle
        label={m.portfolio.openToPartnersLabel}
        hint={m.portfolio.openToPartnersHint}
        checked={openToPartners}
        onChange={(value) => save({ openToPartners: value })}
      />
      <Toggle
        label={m.portfolio.searchIndexableLabel}
        hint={m.portfolio.searchIndexableHint}
        checked={searchIndexable}
        onChange={(value) => save({ searchIndexable: value })}
      />

      {pending && <p className="text-sm text-zinc-500">{m.projects.saveBusy}</p>}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
