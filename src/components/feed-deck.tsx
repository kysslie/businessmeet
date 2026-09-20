"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordSwipe } from "@/app/feed/actions";
import { m } from "@/lib/messages";
import { ProfileCard, type FeedCard } from "./profile-card";

// How far (in pixels) a card must be dragged sideways to count as a swipe.
const SWIPE_DISTANCE = 100;

export function FeedDeck({ initialCards }: { initialCards: FeedCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const [dragX, setDragX] = useState(0);
  // Set when a like turns into a match: shows the "It's a match!" screen.
  const [match, setMatch] = useState<{ conversationId: string; name: string; avatarUrl: string | null } | null>(null);
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
    } else if (result.conversationId) {
      setMatch({ conversationId: result.conversationId, name: card.displayName, avatarUrl: card.avatarUrl });
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

  // Shown on top of everything when a like becomes a match.
  const matchScreen = match && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={m.feed.matchDialog}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl bg-background p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-4xl dark:bg-zinc-800">
          {match.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">🙂</span>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{m.feed.matchTitle}</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {m.feed.matchText(match.name)}
          </p>
        </div>
        <Link
          href={`/matches/${match.conversationId}`}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-base font-medium text-background"
        >
          {m.feed.matchOpen(match.name)}
        </Link>
        <button
          type="button"
          onClick={() => setMatch(null)}
          className="h-12 w-full rounded-xl border border-zinc-300 px-5 text-base font-medium dark:border-zinc-700"
        >
          {m.feed.keepSwiping}
        </button>
      </div>
    </div>
  );

  if (!card) {
    return (
      <>
      {matchScreen}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
        <p className="text-lg font-medium">{m.feed.caughtUp}</p>
        <p className="text-sm text-zinc-500">{m.feed.caughtUpText}</p>
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
          {checking ? m.feed.checking : m.feed.check}
        </button>
      </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {matchScreen}
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
        <ProfileCard card={card} />
        {dragX > 30 && (
          <span className="absolute left-4 top-4 rounded-lg border-2 border-green-600 px-3 py-1 text-lg font-bold text-green-600">
            {m.feed.likeBadge}
          </span>
        )}
        {dragX < -30 && (
          <span className="absolute right-4 top-4 rounded-lg border-2 border-red-600 px-3 py-1 text-lg font-bold text-red-600">
            {m.feed.passBadge}
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
          aria-label={m.feed.pass(card.displayName)}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-300 text-2xl dark:border-zinc-700"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => void decide("like")}
          aria-label={m.feed.like(card.displayName)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-2xl text-background"
        >
          ♥
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">
        {m.feed.hint(cards.length)}
      </p>
    </div>
  );
}
