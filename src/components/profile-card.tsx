import { countryName } from "@/lib/countries";
import {
  AMBITIONS,
  IDEA_STATUSES,
  WEEKLY_HOURS,
  WORK_MODES,
  labelsFor,
} from "@/lib/profile-options";

// What one person's card shows. Built on the server (from get_feed(), or from a matched
// person's profile) plus a photo link.
export type FeedCard = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  workModes: string[];
  ideaStatuses: string[];
  pitch: string | null;
  weeklyHours: string[];
  partnerWeeklyHours: string[];
  ambitions: string[];
  categories: string[];
  offers: string[];
  seeks: string[];
};

function Chips({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// The photo, name, place and answers of one person. Used on swipe cards and on a match's page.
export function ProfileCard({ card }: { card: FeedCard }) {
  const workModes = labelsFor(WORK_MODES, card.workModes).join(" · ");
  const place = [card.district, card.city, countryName(card.country)].filter(Boolean).join(", ");
  const hours = (list: string[]) => `${labelsFor(WEEKLY_HOURS, list).join(", ")} h/week`;
  return (
    <>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-zinc-200 text-6xl text-zinc-400 dark:bg-zinc-800">
        {card.avatarUrl ? (
          // Plain <img>: the address is a short-lived signed link, not a fixed image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt={`Photo of ${card.displayName}`}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">🙂</span>
        )}
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{card.displayName}</h2>
          <p className="text-sm text-zinc-500">{workModes}</p>
          {place && <p className="text-sm text-zinc-500">{place}</p>}
        </div>
        <div>
          <p className="font-medium">{labelsFor(IDEA_STATUSES, card.ideaStatuses).join(" · ")}</p>
          {card.pitch && (
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">&ldquo;{card.pitch}&rdquo;</p>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Can commit</dt>
            <dd className="text-right">{hours(card.weeklyHours)}</dd>
          </div>
          {card.partnerWeeklyHours.length > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Wants a partner at</dt>
              <dd className="text-right">{hours(card.partnerWeeklyHours)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Ambition</dt>
            <dd className="text-right">{labelsFor(AMBITIONS, card.ambitions).join(" · ")}</dd>
          </div>
        </dl>
        <Chips title="Into" items={card.categories} />
        <Chips title="Offers" items={card.offers} />
        <Chips title="Looking for" items={card.seeks} />
      </div>
    </>
  );
}
