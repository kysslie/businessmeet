// Matching (swipe feed, mutual match, chat, block/report, Parcours groups) was parked on
// 2026-09-22 when the product pivoted to a portfolio ("Le CV de l'entrepreneur"). The code,
// migrations and tests all stay as they were; this flag only decides whether the pages are
// reachable. Off (unset, or anything other than "true") until matching returns as a layer on
// top of projects and "open to partners" profiles. Server-only: never expose this to the
// browser (no NEXT_PUBLIC_ prefix needed, nothing here is a secret, it's just not the client's
// business).
export const matchingEnabled = process.env.FEATURE_MATCHING === "true";

// Where a logged-in visitor lands when they have no business being on a matching page (the
// old feed/matches/journeys) or on a login page. Profile is "home" until P2/P3 give it
// something better (e.g. "Mes projets").
export const homePath = matchingEnabled ? "/feed" : "/profile";
