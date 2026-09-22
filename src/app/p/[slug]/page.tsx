import { notFound } from "next/navigation";
import { cache } from "react";
import { countryName } from "@/lib/countries";
import { m } from "@/lib/messages";
import { PROJECT_OUTCOMES } from "@/lib/project-options";
import { createClient } from "@/lib/supabase/server";

type PublicProfile = {
  display_name: string;
  avatar_path: string | null;
  country: string | null;
  city: string | null;
  open_to_partners: boolean;
  search_indexable: boolean;
  category_names: string[] | null;
  offers: string[] | null;
  seeks: string[] | null;
};

type PublicProject = {
  id: string;
  name: string;
  category_name: string;
  started_on: string;
  ended_on: string | null;
  role: string | null;
  outcome: string;
  lessons: string;
  links: { label: string; url: string }[];
};

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

// Cached per request: generateMetadata() and the page component both need this, and the
// view-counter call inside it must only fire once per real visit, not once per call site.
const loadPortfolio = cache(async (slug: string) => {
  const supabase = await createClient();
  const [profile, projects] = await Promise.all([
    supabase.rpc("get_public_profile", { p_slug: slug }),
    supabase.rpc("get_public_projects", { p_slug: slug }),
  ]);
  if (profile.error || projects.error) {
    console.error("loadPortfolio failed:", profile.error?.code, projects.error?.code);
    return null;
  }
  const person = (profile.data as PublicProfile[])[0];
  if (!person) return null;

  // Best-effort: the avatars bucket is readable by logged-in users; a logged-out visitor may
  // not get a photo link, and that is fine — the page still works without one.
  let avatarUrl: string | null = null;
  if (person.avatar_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(person.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  // A visitor who is allowed to view the page also counts as a visit (the database itself
  // decides whether this visit actually moves the counter: never the owner, never someone
  // this page would not otherwise let in).
  await supabase.rpc("increment_page_view", { p_slug: slug });

  return { person, avatarUrl, projects: (projects.data as PublicProject[]) ?? [] };
});

export async function generateMetadata({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);
  if (!portfolio) return {};
  return {
    title: portfolio.person.display_name,
    robots: portfolio.person.search_indexable ? undefined : { index: false, follow: false },
  };
}

export default async function PublicPortfolioPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const portfolio = await loadPortfolio(slug);
  if (!portfolio) notFound();
  const { person, avatarUrl, projects } = portfolio;

  const place = [person.city, countryName(person.country)].filter(Boolean).join(", ");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-3xl dark:bg-zinc-800">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">🙂</span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{person.display_name}</h1>
        {place && <p className="text-sm text-zinc-500">{place}</p>}
        {person.open_to_partners && (
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700">
            {m.portfolio.page.openToPartners}
          </span>
        )}
        {person.category_names && person.category_names.length > 0 && (
          <p className="text-sm text-zinc-500">{person.category_names.join(" · ")}</p>
        )}
      </header>

      {(person.offers?.length || person.seeks?.length) ? (
        <section className="flex flex-col gap-3 text-sm">
          {person.offers && person.offers.length > 0 && (
            <p>
              <span className="font-medium">{m.card.offers} : </span>
              {person.offers.join(", ")}
            </p>
          )}
          {person.seeks && person.seeks.length > 0 && (
            <p>
              <span className="font-medium">{m.card.looking} : </span>
              {person.seeks.join(", ")}
            </p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        {projects.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {m.portfolio.page.noProjects}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => {
              const range = project.ended_on
                ? `${monthLabel(project.started_on)} – ${monthLabel(project.ended_on)}`
                : `${monthLabel(project.started_on)} – ${m.projects.outcomes.ongoing}`;
              return (
                <li key={project.id} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                  <p className="text-lg font-semibold tracking-tight">{project.name}</p>
                  <p className="text-sm text-zinc-500">
                    {project.category_name} · {range} · {outcomeLabel(project.outcome)}
                    {project.role ? ` · ${project.role}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{project.lessons}</p>
                  {project.links.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {project.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            aria-label={m.portfolio.page.openLink(link.label)}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-xs underline dark:border-zinc-700"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
