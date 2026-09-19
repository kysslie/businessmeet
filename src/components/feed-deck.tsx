"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSwipe } from "@/app/feed/actions";
import {
  AMBITIONS,
  IDEA_STATUSES,
  WEEKLY_HOURS,
  WORK_MODES,
  labelFor,
} from "@/lib/profile-options";

// What one swipe card shows. Built on the server from get_feed() plus a photo link.
export type FeedCard = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  workMode: string;
  ideaStatus: string;
  pitch: string | null;
  weeklyHours: string;
  partnerWeeklyHours: string | null;
  ambition: string;
  categories: string[];
  offers: string[];
  seeks: string[];
};

// How far (in pixels) a card must be dragged sideways to count as a swipe.
const SWIPE_DISTANCE = 100;

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

function CardBody({ card }: { card: FeedCard }) {
  const workMode = labelFor(WORK_MODES, card.workMode);
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
          <p className="text-sm text-zinc-500">
            {workMode}
            {card.city ? ` · ${card.city}` : ""}
          </p>
        </div>
        <div>
          <p className="font-medium">{labelFor(IDEA_STATUSES, card.ideaStatus)}</p>
          {card.pitch && (
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">&ldquo;{card.pitch}&rdquo;</p>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Can commit</dt>
            <dd className="text-right">{labelFor(WEEKLY_HOURS, card.weeklyHours)} h/week</dd>
          </div>
          {card.partnerWeeklyHours && (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Wants a partner at</dt>
              <dd className="text-right">
                {labelFor(WEEKLY_HOURS, card.partnerWeeklyHours)} h/week
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Ambition</dt>
            <dd className="text-right">{labelFor(AMBITIONS, card.ambition)}</dd>
          </div>
        </dl>
        <Chips title="Into" items={card.categories} />
        <Chips title="Offers" items={card.offers} />
        <Chips title="Looking for" items={card.seeks} />
      </div>
    </>
  );
}

export function FeedDeck({ initialCards }: { initialCards: FeedCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | null>(null);

  const card = cards[0];

  // Moves to the next card straight away, then saves. If saving fails the card comes back.
  async function decide(direction: "like" | "pass") {
    if (!card) return;
    setCards((current) => current.slice(1));
    setError(null);
    const result = await recordSwipe(card.id, direction);
    if (!result.ok) {
      setCards((current) => [card, ...current]);
      setError(result.message);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStart.current !== null) setDragX(event.clientX - dragStart.current);
  }
  function onPointerEnd() {
    if (dragStart.current === null) return;
    const distance = dragX;
    dragStart.current = null;
    setDragX(0);
    if (distance > SWIPE_DISTANCE) void decide("like");
    else if (distance < -SWIPE_DISTANCE) void decide("pass");
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
        <p className="text-lg font-medium">You&apos;re all caught up</p>
        <p className="text-sm text-zinc-500">
          No one new to show right now. More people will appear as they join.
        </p>
        <button
          type="button"
          onClick={() =>
            startChecking(() => {
              router.refresh();
            })
          }
          disabled={checking}
          className="h-12 rounded-xl border border-zinc-300 px-5 text-base font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          {checking ? "Checking…" : "Check for new people"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        key={card.id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
          transition: dragX === 0 ? "transform 150ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className="relative cursor-grab select-none overflow-hidden rounded-2xl border border-zinc-200 bg-background shadow-sm active:cursor-grabbing dark:border-zinc-800"
        data-testid="feed-card"
      >
        <CardBody card={card} />
        {dragX > 30 && (
          <span className="absolute left-4 top-4 rounded-lg border-2 border-green-600 px-3 py-1 text-lg font-bold text-green-600">
            LIKE
          </span>
        )}
        {dragX < -30 && (
          <span className="absolute right-4 top-4 rounded-lg border-2 border-red-600 px-3 py-1 text-lg font-bold text-red-600">
            PASS
          </span>
        )}
      </div>

      {error && (
        <p
          className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => void decide("pass")}
          aria-label={`Pass on ${card.displayName}`}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-300 text-2xl dark:border-zinc-700"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => void decide("like")}
          aria-label={`Like ${card.displayName}`}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-2xl text-background"
        >
          ♥
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">
        Swipe the card, or use the buttons. {cards.length} left in this batch.
      </p>
    </div>
  );
}
