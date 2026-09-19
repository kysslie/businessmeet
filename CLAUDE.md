# CLAUDE.md — BusinessMeet

This file is the single source of truth for this project. Read it fully at the start of every session. Keep the ledgers at the bottom up to date.

---

## 1. Who you are working with

- The owner is **Elie**. He is technically literate (Excel, Power Query, VBA, scripting, n8n) but is **not a software developer**.
- He works on **Windows**, in short sessions separated by days.
- **Talk to him in plain English.** No jargon unless it is necessary; if you use a technical term, explain it in one sentence.
- Only ask him things that need **his decision** (cost, product choices, risk, anything destructive). Handle the technical details yourself.
- Be direct and concise. No filler.
- He owns every product decision. You own technical correctness. If he asks for something that is bad practice, say so plainly, explain the consequence in one or two sentences, propose the alternative, then do what he decides and log it.

---

## 2. Project brief (approved 2026-09-19)

| Field | Value |
|---|---|
| **Name** | BusinessMeet (working title) |
| **What it does** | Dating-app-style matching for people who want to start a project (with or without an idea). Users match on shared venture interests, complementary skills, and commitment level. Chat unlocks only after a mutual like. |
| **Target users** | Pre-founders: people with a side-project or small-business ambition, from an indie game on Steam to a local lawn-care business. **Launch audience: indie game makers only.** |
| **Platform** | Mobile-first web app, installable as a PWA |
| **Stack** | TypeScript, Next.js (App Router), Supabase (Postgres, Auth, Realtime, Storage), Vercel hosting, Tailwind |
| **Budget** | €0 during development (free tiers only). Paid plans only at public launch. |
| **MVP scope** | Sign-up/login, profile, swipe feed, mutual match, 1:1 chat, block/report, account deletion, installable PWA |
| **Out of scope for now** | Native apps, payments, AI/algorithmic matching, push or email notifications, LinkedIn import, map/radius search, multi-city, video, admin dashboard, group teams (3+), project pages |

---

## 3. Working rules

### Every session
1. Read this whole file.
2. Open with a three-line status in plain English: current step, last thing completed, proposed next thing.
3. Work on **one feature at a time**. Never start a new feature while one is in progress.

### Before changing things
- For anything bigger than a small fix, first tell Elie in plain English what you are about to do and why. Wait for his OK if it changes the database structure, adds a dependency, or changes how the app is organised. Small bug fixes can go ahead directly.
- **Never** change the tech stack, framework, or architecture without his explicit approval. Log approved changes in the Decision Log below.
- **Never** delete data, migrations, or configuration without stating the consequence and getting his confirmation.
- **Never** silently change code unrelated to the task. If you spot a problem elsewhere, tell him and add it to the Debt Ledger.
- **Never** add scope beyond the MVP. If Elie proposes a new feature mid-build, add it to the Backlog and carry on.

### Dependencies
- Every new package needs a one-line justification: what it solves, why the existing stack can't, and whether it is actively maintained. Tell Elie before adding it.

### Secrets
- **Never** hardcode keys or passwords. All secrets go in `.env.local`, which must be in `.gitignore`.
- Keep `.env.local.example` up to date with variable names only (no values).
- The Supabase service role key is **server-only**. Never prefix it with `NEXT_PUBLIC_` and never use it in browser code.
- Elie creates his own accounts (GitHub, Supabase, Vercel) and pastes keys into `.env.local` himself. Tell him exactly which value to copy from where.

### Honesty
- Check current official docs for anything version-specific (Next.js, Supabase, `@supabase/ssr`, Vercel). APIs and key names change. Do not rely on memory for them.
- Never invent package names, functions, or config keys.
- When debugging, state what you think is wrong and how confident you are before fixing.
- Never tell Elie something works unless you actually ran it. Say "untested" otherwise.

### After every change
- Run it yourself where possible (build, lint, type-check, dev server).
- Give Elie a short plain-English test to do himself: what to click and what he should see.
- A feature is **only complete when Elie confirms it works.**
- Update the ledgers at the bottom of this file.

### Git
- Commit after each working step with a clear message. Never force-push or rewrite history without asking.

---

## 4. Architecture

```
Browser / installed PWA
        │
        ▼
Next.js app on Vercel (App Router, server components, server actions)
        │
        ▼
Supabase: Auth (email + password, email link as fallback) · Postgres with Row Level Security · Realtime (chat) · Storage (profile photos)
```

Key decisions:
- **Row Level Security (RLS) on every table, from the start.** Access rules live in the database. Examples: a user edits only their own profile; reads messages only from matches they belong to; never sees anyone's swipes.
- **Mutual matching happens in a database trigger** on the `swipes` table. When a reciprocal like is inserted, the trigger creates the `matches` row in the same transaction, which avoids race conditions. The trigger needs to read the other user's swipe, which RLS hides, so it should run as `SECURITY DEFINER` with a fixed `search_path`. Keep it minimal.
- **The feed is one Postgres function, `get_feed()`**, called via RPC. It returns up to 20 profiles that:
  - are not the current user and are onboarded;
  - have not already been swiped by the current user;
  - are not blocked in either direction;
  - share at least one **active** category with the current user;
  - share a way of working, **in both directions** (Elie, 2026-09-19: every match must be matchable): both take `remote` (any country), or both take `local` and live in the same place: same country and same city, the city compared ignoring capitals, accents and repeated spaces ("Zürich" = "zurich"). People who pick both Remote and Local reach the widest pool. If A sees B, B sees A.
  - Use `auth.uid()` inside the function. Never accept a user id as a parameter.
- **Categories and skills are data, not code.** They live in tables with `is_active`. All categories are seeded; only **Video games** is active at launch. Activating a new category must require **no code change**: flip `is_active` and optionally insert its skills.
  - While only one category is active, the profile form pre-selects it and hides the picker.
  - The skills shown in the form are universal skills (`category_id IS NULL`) plus skills of the categories the user selected.
- **Login is by email + password** (Elie's decision, 2026-09-19, replacing "magic link only"; see Decision Log and DEBT-001/013/017). Supabase stores only password hashes. The email link stays as the way back in for a forgotten password. Accounts are created on the login page ("Create account"); users change their password on `/profile`.
- **Profile photos** go in a Storage bucket `avatars`, at path `{user_id}/...`. Users may write only in their own folder. Photos may be readable by logged-in users. Choose the simplest secure option per the current Supabase docs.
- **Chat** uses Supabase Realtime on `messages`, filtered by `match_id`, protected by RLS.
- **Account deletion** runs server-side with the service role key, deleting the auth user. Every user foreign key uses `ON DELETE CASCADE`, so all of their data goes with it (GDPR right to erasure).
- **No Docker.** Development uses a hosted Supabase dev project. Schema changes are numbered SQL migration files in `supabase/migrations/`, applied with the Supabase CLI. Confirm in the current docs that pushing to a linked remote project works without Docker; if it doesn't, tell Elie and propose an alternative before proceeding.

---

## 5. Data model

```
profiles            id (PK, = auth.users.id), display_name, avatar_path,
                    country (2-letter code), city, district (nullable),
                    work_modes[], idea_statuses[], pitch, weekly_hours[],
                    partner_weekly_hours[] (nullable), ambitions[],
                    onboarded (bool), created_at, updated_at
categories          id, slug, name, is_active, sort_order
skills              id, slug, name, category_id (nullable = universal), is_active
profile_categories  profile_id, category_id                 (PK both)
profile_skills      profile_id, skill_id, kind              (PK all three)
swipes              swiper_id, target_id, direction, created_at   (PK swiper_id+target_id)
matches             id, user_a, user_b, created_at          (CHECK user_a < user_b, UNIQUE pair)
messages            id, match_id, sender_id, body, created_at
blocks              blocker_id, blocked_id, created_at      (PK both)
reports             id, reporter_id, reported_id, reason, details, created_at
```

Fixed option sets are `text` (or `text[]`, "select all that fit") columns with `CHECK` constraints, not Postgres enums. Changed 2026-09-19 (Elie): most answers are now lists.

| Column | Allowed values | Label shown to users |
|---|---|---|
| `work_modes` (list, at least 1) | `remote`, `local` | Remote / Local. Pick both to reach the widest pool. |
| `country` | 2-letter capital code, e.g. `FR` (list in `src/lib/countries.ts`) | Country dropdown, asked of everyone |
| `city`, `district` | free text (max 100). City required if `local` is picked | City or village / District or arrondissement (optional, shown on the card, not used for matching) |
| `idea_statuses` (list, at least 1) | `has_idea`, `wants_to_join`, `open_to_merge`, `exploring` | I have an idea / I want to join someone's idea / Open to merging ideas / Exploring |
| `weekly_hours` (list, at least 1) | `lt_5`, `5_10`, `10_20`, `20_plus` | Hours per week I can commit: <5 / 5–10 / 10–20 / 20+ (every range that fits) |
| `partner_weekly_hours` (list, null = no preference) | same four values | Hours per week I'd like a partner to commit (optional, every range that fits). The feed does not filter on either hours field. |
| `ambitions` (list, at least 1) | `for_fun`, `side_income`, `full_time` | Side project for fun / Side income / Aim to go full-time (e.g. side income first, full-time later) |
| `profile_skills.kind` | `offers`, `seeks` | — |
| `swipes.direction` | `like`, `pass` | — |

Other rules:
- `pitch`: max 280 characters. Required only when `idea_statuses` contains `has_idea`.
- Onboarding is complete (`onboarded = true`) only with: name, country, at least one work mode / idea status / hours range / ambition; a city if `local` is picked; a pitch if `has_idea` is picked (database CHECK `profiles_onboarded_complete`).
- `messages.body`: max 2000 characters, not empty.
- Every foreign key pointing to a user uses `ON DELETE CASCADE`.

### Seed data (`supabase/seed.sql` or a seed migration)

Categories (slug, name, active):
- `video_games`, Video games, **active**
- `local_services`, Local services, inactive
- `ecommerce`, E-commerce, inactive
- `content_media`, Content/media, inactive
- `apps_software`, Apps/software, inactive
- `food`, Food, inactive
- `other`, Other, inactive

Universal skills (`category_id` null): Marketing, Community management, Sales, Finance/admin, Project management.

Video games skills: Game programming, Game design, Level design, 2D art, 3D art, Animation, Audio/music, Writing/narrative, QA/testing.

Skills for the other categories get added when each category is activated.

---

## 6. Folder structure

```
businessmeet/
├─ CLAUDE.md
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                     landing
│  │  ├─ login/page.tsx
│  │  ├─ auth/callback/route.ts       magic-link handler (exchanges the emailed code for a session)
│  │  ├─ auth/actions.ts              signOut
│  │  ├─ onboarding/page.tsx
│  │  ├─ feed/page.tsx
│  │  ├─ matches/page.tsx
│  │  ├─ matches/[matchId]/page.tsx   chat
│  │  ├─ profile/page.tsx
│  │  ├─ settings/page.tsx            block list, delete account
│  │  ├─ privacy/page.tsx
│  │  ├─ manifest.ts
│  │  └─ layout.tsx
│  ├─ components/
│  ├─ lib/
│  │  ├─ supabase/                    client.ts, server.ts, middleware helpers
│  │  └─ validation/
│  └─ types/database.ts               generated from the DB schema
├─ supabase/
│  ├─ migrations/
│  └─ seed.sql
├─ src/proxy.ts                       redirects logged-out users (Next.js 16 name for middleware)
├─ .env.local.example
└─ package.json
```

Adjust file names to the current Next.js / Supabase conventions if they differ, and tell Elie if you do.

---

## 7. Planned dependencies

| Package | Purpose |
|---|---|
| `next`, `react`, `typescript` | Framework |
| `@supabase/supabase-js` | Database, auth, and realtime client |
| `@supabase/ssr` | Session cookies across server and browser (confirm it is still the recommended package) |
| `tailwindcss` | Styling (via the Next.js scaffold) |
| `zod` | Server-side validation of form input |

Anything else needs justification and Elie's OK.

---

## 8. Code conventions

- TypeScript in strict mode. ESLint with the Next.js defaults. Prettier for formatting.
- File names in kebab-case. React components in PascalCase. Variables and functions in camelCase.
- SQL identifiers in snake_case, with plural table names.
- Mobile-first layout, clean and simple UI.

---

## 9. Build plan (in order, one at a time)

| # | Feature | Done when |
|---|---|---|
| F0 | **Setup.** Check that Node.js LTS and Git are installed (if not, give Elie the exact download links and steps). Scaffold Next.js with TypeScript, Tailwind, ESLint, App Router and `src/`. If the scaffold refuses because the folder isn't empty (CLAUDE.md), scaffold into a temp subfolder and move the files up. Create the Git repo and `.gitignore`. Walk Elie through creating a GitHub repo, a Supabase dev project, and a Vercel project linked to GitHub. Set env vars locally and on Vercel. Deploy. | The live Vercel URL shows the landing page |
| F1 | Schema migrations, RLS policies, seed data | Tables visible in the Supabase dashboard; RLS checked with test queries |
| F2 | Magic-link login, logout, route protection | Logged-out users are redirected; login works end to end |
| F3 | Onboarding and profile edit, including photo upload | A new user completes a profile; edits persist |
| F4 | Feed and swipe via `get_feed()` | The feed shows only eligible profiles; swiped ones never come back |
| F5 | Mutual-match trigger and matches list | Two test accounts liking each other both see the match |
| F6 | Realtime 1:1 chat | Messages appear live in two browser windows |
| F7 | Block and report | A blocked user disappears from the feed and matches; reports are stored |
| F8 | Account deletion and privacy page | Deleting an account removes all of that user's rows |
| F9 | PWA install (manifest, icons), production check, full smoke test | The app installs on a phone home screen; the whole flow works in production |

Give Elie a simple way to test with two accounts (e.g. two email addresses, or a normal window plus a private window).

---

# LEDGERS — keep these updated

## Build Ledger

**Current milestone:** MVP

**Completed features:**
- F0 — Setup (confirmed by Elie 2026-09-19). Live at https://businessmeet.vercel.app/. GitHub: kysslie/businessmeet. Vercel gotcha: Framework Preset must be Next.js.

- F1 — Schema migrations, RLS policies, seed data (confirmed by Elie 2026-09-19). 3 migrations applied to the hosted dev project. `supabase/tests/rls_smoke_test.sql`: 83/83 checks passed; `db advisors`: no issues; no test data left behind.

- F2 — Magic-link login, logout, route protection (confirmed by Elie 2026-09-19: login works, session survives refresh, logout works, logged-out `/feed` redirects to `/login`). Packages added: `@supabase/supabase-js`, `@supabase/ssr`, `zod`. First real-email test failed (standard link returns `?code=`, first version only understood `token_hash`); fixed in `auth/callback/route.ts`. Elie decided to live with the standard email for now (DEBT-001).

- F3 — Onboarding and profile edit, including photo upload (validated by Elie 2026-09-19). Onboarding worked with two real accounts. **Not tested by Elie, he waived it: photo upload/replace/remove and the phone layout.** Tested by me only, with throwaway users. Migration `20260919160000_avatars_storage.sql`; RLS/storage tests in `supabase/tests/rls_smoke_test.sql`.

- F4 — Feed and swipe via `get_feed()` (validated by Elie 2026-09-19): a real second account appeared in the first one's feed; liking it made it disappear (1 like recorded). **Not tested by Elie, he waived it: drag-to-swipe and phone layout.** Rule made two-way (both Remote, or same place) and later rebuilt for the profile redesign.

- Password login (validated by Elie 2026-09-19): created a second account with email + password, changed his temporary password on `/profile` (verified: the old password is refused). "Confirm email" is off in Supabase (DEBT-017).

- Shipped but NOT yet confirmed by Elie: the **profile redesign** (select-all-that-fit answers, Remote/Local switches, country + city + district; migration `20260919190000_profile_multiselect.sql`). Both his accounts were set back to "not onboarded" and still are: nobody has finished the new form yet, so neither account currently appears in a feed. See "Pending tests for Elie".

**In progress:** F5 — Mutual-match trigger and matches list. Started 2026-09-19 after Elie said to validate F3/F4 and move on.

Rule for schema changes: all table/column/policy changes go through a new numbered file in `supabase/migrations/`, never through the Supabase dashboard's Table Editor (dashboard edits are not recorded in the repo and new columns would miss the grants). Editing data rows in the dashboard (e.g. flipping `categories.is_active`, adding skills) is fine.

How to work with the database from here (no Docker, no password prompt needed once linked and logged in):
- Apply migrations: `npx supabase@2.117.0 db push` (preview first with `--dry-run`)
- Run the security tests: `npx supabase@2.117.0 db query --linked -f supabase/tests/rls_smoke_test.sql` (it always ends with a deliberate "error" that holds the PASS/FAIL report and rolls everything back)
- Automatic security check: `npx supabase@2.117.0 db advisors --linked`
- Every new migration must also revoke default grants and grant only what is needed, then enable RLS (see migration 2).

**Next planned step:** finish F5, then F6 (realtime chat). Elie should complete the redesigned profile on both accounts (country etc.) so they can see each other and test matching.

Notes for later features:
- F4: `get_feed()` must be `SECURITY DEFINER` with a fixed `search_path` (users cannot read other people's profiles directly); it must return the candidate's skills/categories and enough info to build a signed photo link (`avatar_path`), and signed links for other people's photos are created server-side.
- F8: deleting an auth user does NOT delete Storage files. The delete-account code must first remove everything under `avatars/{user_id}/` (with the secret key), then delete the user. Add a test.
- F6: the plain Node 20 runtime has no built-in WebSocket; Next.js/Vercel handle it, but check realtime works in local dev on Node 20.

**Pending tests for Elie** (a feature is only complete when he confirms it). Mirrored in Claude's memory file `project_pending-tests-for-elie.md`.
Waived by Elie on 2026-09-19 (not to be re-asked unless he raises them): photo upload from his phone and the F3/F4 phone layout checks. They remain untested by him.
Still unconfirmed:
- Profile redesign: both accounts must finish the new form (pick a country, Remote/Local switches, several answers, optional district). Then: Local + same country and city sees each other (try "lyon" vs "Lyon "), two Remote accounts always see each other, the card shows place and lists.
- F2 leftovers: opening an email login link in a different browser (expects the "same browser" message); whether Outlook link scanning uses up the link; the "Forgot your password?" email link.
- F4 leftover: drag-to-swipe on a real phone (waived, see above).
- F5: added here when shipped.

**Ideas file:** `ideas.txt` in the project root is Elie's private scratchpad for future ideas. It is git-ignored (never committed). Read it at the start of each session; move anything worth keeping into the Backlog below, in Elie's words.

**Backlog (post-MVP):**
- Place search with suggestions (autocomplete from an outside service) for a canonical city, spelling variants across languages, and distance/radius matching later. Kept out of the MVP; today's city is free text compared ignoring capitals/accents/spaces. (Elie chose the simple version, 2026-09-19)
- Broader "Haves and Needs" beyond skills (e.g. capital, network, equipment, domain expertise), and industry-specific haves/needs grouped per industry when more categories open. Elie: fine as game-design skills only for now. The categories/skills tables already support per-industry skills; this is about widening what people can offer or seek. (Elie, 2026-09-19)
- Collaboration type / capital search: whether someone wants paid help (freelance, for cash) or a true partner who works for a share of the venture. The equity partner is the original vision of the app; the paid-help side is an interesting extension. Likely a profile field plus a search filter. (From ideas.txt, 2026-09-19)
- Custom email (SMTP) for login: removes the 2-emails-per-hour limit, allows a proper branded email template, and fixes the login link only working in the browser that requested it. See DEBT-001. Elie: fine for now, fix later (re-check at F5, which needs two accounts)
- Email/push notifications on new match (first priority after MVP)
- Easier discovery beyond swipe-style matching (browse/search profiles; revisit the strict profile-visibility rule). Elie: "we are not strictly a dating app"
- Compatibility-ranked feed (can use `weekly_hours` vs `partner_weekly_hours`)
- Radius/map search for local projects
- Group teams (3+ people), project pages
- Activate more categories: Local services, E-commerce, Content/media, Apps/software, Food, Other

## Decision Log

Format: `date | decision | rejected alternatives | reason`

- 2026-09-19 | Audience: pre-founders (idea-stage or no idea) matching on shared venture interests | Startup co-founder/VC matching | Elie's target problem
- 2026-09-19 | Launch seeded on indie game dev only; data model generic across categories | All categories at launch | Avoid an empty feed with few users spread thin
- 2026-09-19 | Platform: mobile-first web app as PWA | Native (Expo), no-code tools | One codebase, no store fees, no Mac needed
- 2026-09-19 | Stack: TypeScript + Next.js + Supabase + Vercel | Expo, Bubble/FlutterFlow, Django/Laravel | Free tiers, built-in auth/realtime, strong AI-assist support
- 2026-09-19 | MVP matching = filter (shared category + work-mode compatibility), not an algorithm | Scored ranking | Ship first, rank later
- 2026-09-19 | Categories and skills stored as data with `is_active`; new category = data change, not code change | Hardcoded lists | Elie wants to add categories easily later
- 2026-09-19 | Magic-link login only | Email + password | No password storage or reset flow
- 2026-09-19 | Hosted Supabase dev project, SQL migrations in repo, no Docker | Local Docker stack | Docker is heavy on Windows; migrations keep schema history
- 2026-09-19 | Matching via DB trigger; feed via `get_feed()` DB function | App-code logic | Atomic matching; filtering done in the database
- 2026-09-19 | Built by Claude Code, with planning in a separate Claude chat; this file is the handover | Cowork for coding | Claude Code works directly on the project files
- 2026-09-19 | Communicate with Elie in plain English; technical detail only when a decision needs it | — | Elie's preference
- 2026-09-19 | Supabase key naming follows current docs: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (was "anon key") and server-only `SUPABASE_SECRET_KEY` (was "service role key"). Wherever this file says "service role key", it means the secret key. | Legacy anon/service_role keys | Legacy keys are being deprecated by end of 2026
- 2026-09-19 | Profile privacy for MVP: users can read only their own profile and their matches' profiles; the swipe feed hands out candidates through the `get_feed()` function (F4). Elie: fine for now, wants people to find each other more easily than in a dating app, revisit after MVP | Letting every logged-in user read all onboarded profiles | Stops scraping of the whole user list; easy to loosen later with a policy change
- 2026-09-19 | Added optional `profiles.partner_weekly_hours` (hours I'd like a partner to commit; null = no preference) alongside `weekly_hours`; neither filters the feed | Exact hours; nothing new | Elie wants full-timers and part-timers to find each other
- 2026-09-19 | Sign-up trigger creates an empty profile row for every new auth user; `onboarded` only true when required fields are filled (DB constraint). Length limits chosen: display name 50, city 100, report reason 100, report details 1000 | Client-side profile insert | Profile always exists; rules live in the database
- 2026-09-19 | F2 login design: Supabase's standard email link (PKCE) returns to `/auth/callback` (route handler) with a one-time `code`, exchanged for a session with `exchangeCodeForSession`; the handler also accepts `token_hash` links for a future custom template; session checked with `getClaims()`; `src/proxy.ts` (not `middleware.ts`, renamed in Next.js 16) guards all pages except `/`, `/login`, `/privacy`, `/auth/*` | Custom email template with `token_hash` and a "Log in" button page (first attempt, built and then removed: hosted Supabase does not allow editing templates without custom SMTP, so real emails carried `?code=` and were rejected as invalid) | Works at zero cost today. Known limits: the link must be opened in the same browser that requested it, and mail scanners can use up the link (see DEBT-001, DEBT-009)
- 2026-09-19 | F3 profile photos: private `avatars` bucket, path `{user_id}/{random}.{jpg|png|webp}`, 2 MB limit and image types enforced by the bucket; any logged-in user may read, only the owner may add/delete in their own folder; shown via 1-hour signed links; photos shrunk to max 800 px in the browser (built-in canvas, no new package) and uploaded through the `saveProfile` server action (body limit raised to 3 MB); `profiles.avatar_path` must point inside the user's own folder. Photo optional; at least 1 offered skill required (Elie, 2026-09-19) | Public bucket; direct browser upload | Matches the brief ("readable by logged-in users"), one submit, no orphaned files on failed saves
- 2026-09-19 | F4 feed: random order, max 20 per batch; UI = one card at a time, drag or ✕/♥ buttons; swipes are permanent | Ranked feed; undo | Ship first, rank later (per brief)
- 2026-09-19 | Work-mode rule made two-way (migration `20260919180000_get_feed_symmetric.sql`): two people see each other only if both are Remote OK, or they are in the same city (trimmed, case-insensitive). Elie: "every match must be matchable" | The first version followed the brief literally (the viewer's own mode decides), which let a Remote OK person see a Local-only person in another city who could never see them back | A like that can never become a match is a dead end
- 2026-09-19 | Login switched to email + password (login page has "Log in" / "Create account" tabs; email link kept as a "forgot password" fallback; `/profile` has a change-password form that first checks the current password; passwords 8 to 72 characters). Elie's temporary password was set directly in the database by Claude and given to him in chat once; he is to change it on `/profile` | Magic link only (the earlier decision); custom SMTP now | Elie: "bypass this whole email thing". The built-in email limit (2 per hour) made testing impossible. Consequences explained: real email verification is skipped if "Confirm email" is off (DEBT-017), no password reset without email, breach-checking unavailable (DEBT-013)
- 2026-09-19 | Profile redesign (Elie: "select all that fit", widest possible pool; migration `20260919190000_profile_multiselect.sql`): work mode is a set (Remote and/or Local, both pre-selected for new profiles); location = country dropdown (everyone) + city/village (required for Local) + optional district/arrondissement (country and city matter most; district is only shown); hours, partner hours, ambition and idea status are multi-select; new idea option "Open to merging ideas"; the feed matches on a shared way of working (both Remote, or both Local in the same country and city, ignoring capitals/accents/spaces). Existing answers were copied into lists; both existing profiles were set back to "not onboarded" so their owners confirm a country once (form pre-filled) | Place search with suggestions (more accurate, needs an outside service, kept for later); single-choice answers | Bigger pool, better fit for people whose situation is not one box. Consequences: remote-only people no longer see Local-only people in their own city unless they also pick Local; spelling variants across languages (Beirut/Beyrouth) do not match
- 2026-09-19 | Next.js 16.3.5 (React 19, Tailwind 4, ESLint 9) scaffolded with create-next-app; `AGENTS.md` from the scaffold kept (tells AI tools to check bundled Next.js docs) | — | Current stable versions; matches the "check current docs" rule

## Debt Ledger

Tags: `[BLOCKER]` `[HIGH]` `[LOW]`

- [HIGH] DEBT-001 Supabase built-in email: (a) limited to 2 emails per hour for the whole project (docs, 2026-09-19), which limits testing (F5 needs two accounts); (b) email templates cannot be edited without custom SMTP (confirmed by Elie 2026-09-19), so the login link must be opened in the same browser that requested it and mail scanners can use it up. Set up custom SMTP before F5 or before public launch, whichever comes first, then move to a `token_hash` template with a "Log in" button page.
- [LOW] DEBT-010 "At least one offered skill" is enforced by the app only (`saveProfile`), not by the database, because a CHECK cannot look at another table. Anyone calling the API directly could finish onboarding with no skills. Add a trigger if this matters.
- [LOW] DEBT-011 `saveProfile` is several separate database calls, not one transaction. If one fails midway the person is asked to save again (the profile row is saved last, so `onboarded` never flips early). Convert to a single database function if it ever causes real problems.
- [LOW] DEBT-012 Photo links are readable by any logged-in user who knows the exact file path (path contains two random IDs). Accepted for the MVP per the brief; revisit with the profile-visibility rule.
- [HIGH] DEBT-013 Passwords are now the main login (2026-09-19). Supabase advisor warns "leaked password protection disabled" (checks passwords against known breaches; may need a paid Supabase plan, check current docs). App-side rules today: 8 to 72 characters, current password required to change it. Revisit before public launch.
- [HIGH] DEBT-017 If Supabase "Confirm email" is switched OFF (so accounts can be created without email, which Elie wants while the email limit exists), anyone can register with an address they do not own; no email is ever verified, and there is no password reset except the email-link fallback (which needs working email, DEBT-001). Fine for private testing. Before public launch: turn "Confirm email" back ON and set up custom SMTP (DEBT-001). Also clean out any accounts made with fake addresses.
- [LOW] DEBT-018 City and district are free text. The same place written in another language or with a typo (Beirut/Beyrouth, Lyon/Lion) does not match. Country is a fixed list, so only the city part can drift. Fix later with place search (see Backlog).
- [LOW] DEBT-014 Recording a swipe only checks that you are the swiper and the target exists; it does not re-check that the target is in your feed (onboarded, not blocked, shares a category). Harmless today (swipes alone do nothing). The F5 match trigger and F7 block logic must not create matches with blocked or non-onboarded people.
- [LOW] DEBT-015 Supabase advisor warns that `get_feed` is a SECURITY DEFINER function callable by logged-in users. Intentional and accepted (it is the controlled way to see other people; uses `auth.uid()`, no parameters, returns only card fields).
- [LOW] DEBT-016 Swipes cannot be undone and there is no "seen you already" review list. A mis-tap is permanent. Consider an undo for the last swipe after the MVP.
- [HIGH] DEBT-009 On iPhones an installed PWA has separate storage from Safari, so a magic link opened from the mail app logs the user in in Safari, not inside the installed app. Decide before F9 whether to add a 6-digit code option (needs a custom email template, so needs custom SMTP first, see DEBT-001).
- [HIGH] DEBT-002 Vercel Hobby plan is for non-commercial use. Move to Pro before monetising (check current terms).
- [LOW] DEBT-003 Supabase free tier pauses inactive projects. Expect to unpause the dev project between sessions (check current policy).
- [HIGH] DEBT-004 Privacy policy and terms (including an 18+ age rule) need a real review before launch. What gets drafted here is not legal advice.
- [LOW] DEBT-005 `npm install` warns that ESLint 9.39.5 is no longer supported. Upgrade when `eslint-config-next` supports the newer major.
- [LOW] DEBT-006 `globals.css` sets body font to Arial, overriding the Geist font the scaffold loads. Decide on the app font during UI work.
- [HIGH] DEBT-008 `SUPABASE_SECRET_KEY` in `.env.local` was rejected (HTTP 401) by the Supabase admin API on 2026-09-19; the publishable key and URL work. Cause unknown (possible copy error or key format). Re-copy the secret key from Supabase Settings > API Keys and re-test before F8.
- [LOW] DEBT-007 Unused scaffold images remain in `public/` (next.svg, vercel.svg, etc.). Remove during cleanup.
