import { m } from "@/lib/messages";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
    </section>
  );
}

// Public page (see src/proxy.ts). A draft, written for P5, pending legal review — see the
// comment in src/lib/messages/fr.ts and DEBT-004/020/022 in CLAUDE.md.
export default function PrivacyPage() {
  const p = m.privacy;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{p.title}</h1>
        <p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {p.draftNotice}
        </p>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{p.intro}</p>
      </div>

      <Section title={p.responsibleTitle} body={p.responsibleBody} />
      <Section title={p.dataTitle} body={p.dataBody} />
      <Section title={p.purposesTitle} body={p.purposesBody} />
      <Section title={p.whoSeesTitle} body={p.whoSeesBody} />
      <Section title={p.processorsTitle} body={p.processorsBody} />
      <Section title={p.cookiesTitle} body={p.cookiesBody} />
      <Section title={p.retentionTitle} body={p.retentionBody} />
      <Section title={p.rightsTitle} body={p.rightsBody} />
      <Section title={p.deletionTitle} body={p.deletionBody} />
      <Section title={p.acquisitionTitle} body={p.acquisitionClause} />
      <Section title={p.ageTitle} body={p.ageBody} />
      <Section title={p.changesTitle} body={p.changesBody} />
      <Section title={p.contactTitle} body={p.contactBody} />
    </main>
  );
}
