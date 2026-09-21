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
| **Target users** | **First-time founders who want to start a small, non-tech business** (local services and trades, food, e-commerce, and similar), with or without an idea, plus remote-OK people who can help from anywhere. Anyone with a side-project ambition is welcome, including tech (indie games, apps). **All categories are open at launch** (changed 2026-09-19 by Elie; the original launch audience was indie game makers only). |
| **Launch region** | **Île-de-France**, plus remote-OK profiles from anywhere (Elie, 2026-09-20). |
| **Pricing at launch** | **100% free.** No payment code, no Stripe. Founding-member wording: see Decision Log 2026-09-20 (E). |
| **Platform** | Mobile-first web app, installable as a PWA |
| **Stack** | TypeScript, Next.js (App Router), Supabase (Postgres, Auth, Realtime, Storage), Vercel hosting, Tailwind |
| **Budget** | €0 during development (free tiers only). Paid plans only at public launch. |
| **MVP scope** | Sign-up/login, profile, swipe feed, mutual match, 1:1 chat, unmatch, block/report, account deletion, launch metrics (SQL views), installable PWA |
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
- **Mutual matching happens in a database trigger** on the `swipes` table. When a reciprocal like is inserted, the trigger creates the `matches` row in the same transaction, which avoids race conditions. The trigger needs to read the other user's swipe, which RLS hides, so it should run as `SECURITY DEFINER` with a fixed `search_path`. Keep it minimal. Since 2026-09-20 the same trigger also creates the `direct` conversation with its two participants and stores `conversation_id` on the match row.
- **The feed is one Postgres function, `get_feed()`**, called via RPC. It returns up to 20 profiles that:
  - are not the current user and are onboarded;
  - have not already been swiped by the current user;
  - are not blocked in either direction;
  - share at least one **active** category with the current user;
  - share a way of working, **in both directions** (Elie, 2026-09-19/20: every match must be matchable): both take `remote` (any country), or both take `local` and live in the same **zone**. Zone: in France with a postal code, **all of Île-de-France (departments 75, 77, 78, 91, 92, 93, 94, 95) is one zone** and elsewhere the zone is the **department**; anywhere else (or without a postal code) it is the same country and city, compared ignoring capitals, accents and repeated spaces. If A sees B, B sees A. The postal code is never returned by the feed nor readable by other users.
  - Use `auth.uid()` inside the function. Never accept a user id as a parameter.
- **Categories and skills are data, not code.** They live in tables with `is_active`. **All seven seeded categories are active** (Elie, 2026-09-19); closing or opening one is a data change (flip `is_active`), and a new category's skills are rows in `skills`. No code change.
  - The profile form shows the category picker whenever more than one category is active (if only one is ever active again it is pre-selected and the picker is hidden).
  - The skills shown in the form are universal skills (`category_id IS NULL`) plus skills of the categories the user selected.
- **Login is by email + password** (Elie's decision, 2026-09-19, replacing "magic link only"; see Decision Log and DEBT-001/013/017). Supabase stores only password hashes. The email link stays as the way back in for a forgotten password. Accounts are created on the login page ("Create account"); users change their password on `/profile`.
- **French only for the launch** (Elie, 2026-09-20). Every piece of text (screens, error messages, validation, option labels) lives in ONE file, `src/lib/messages/fr.ts`, with its type in `src/lib/messages/index.ts`; no i18n library. To add English later: write `en.ts` with the same shape and pick it in `index.ts`. Category and skill names are data in the database (also French, see the proposed migration). Country names come from the browser's built-in French region names.
- **Private profile columns** (2026-09-20): `postal_code`, `last_seen_at` and `is_demo` cannot be read through the API by any logged-in user (column-level privileges; chat partners can read other profile columns by row level security, so this is enforced per column). The app therefore lists the columns it reads (`src/lib/profile-columns.ts`, never `select *`), the owner reads their own postal code with `get_my_postal_code()`, and `last_seen_at` is written only by `touch_last_seen()`. Any new `profiles` column must be added to the column list in a migration on purpose.
- **Profile photos** go in a Storage bucket `avatars`, at path `{user_id}/...`. Users may write only in their own folder. Photos may be readable by logged-in users. Choose the simplest secure option per the current Supabase docs.
- **Chat** (built 2026-09-20, Elie's model) is built around **conversations with participants**, NOT one chat per match: `conversations` (type `direct` | `group`, `archived_at`), `conversation_participants` (`joined_at`, `left_at`), `messages` (`conversation_id`). The MVP only uses `direct`; `group` exists so Phase 2 teams need no chat rewrite. Realtime runs on `messages`, filtered by `conversation_id`.
  - Row level security: a user can **read** messages only in conversations where they are a current participant (`left_at` is null); they can **write** only if the conversation is also **not archived** (an archived conversation is read-only).
- **Matches never expire** (Elie, 2026-09-20). A match lasts until one user explicitly **unmatches** or **blocks**; there is no automatic expiry and no inactivity cleanup. **Unmatch** removes the match from both users' lists and archives the conversation (read-only); it never deletes messages. **Block** hides the two users from each other with no further contact (F7).
- **Launch metrics without a new tool** (built 2026-09-20): `profiles.last_seen_at`, updated at most once per hour when the user opens the app, and three admin-only SQL views (`metrics_active_profiles`, `metrics_weekly_matches`, `metrics_retention_30d`) read from the Supabase SQL editor. No analytics service.
- **Account deletion** runs server-side with the service role key, deleting the auth user. Every user foreign key uses `ON DELETE CASCADE`, so all of their data goes with it (GDPR right to erasure).
- **No Docker.** Development uses a hosted Supabase dev project. Schema changes are numbered SQL migration files in `supabase/migrations/`, applied with the Supabase CLI. Confirm in the current docs that pushing to a linked remote project works without Docker; if it doesn't, tell Elie and propose an alternative before proceeding.

---

## 5. Data model

```
profiles            id (PK, = auth.users.id), display_name, avatar_path,
                    country (2-letter code), city, district (nullable),
                    work_modes[], idea_statuses[], pitch, weekly_hours[],
                    partner_weekly_hours[] (nullable), ambitions[],
                    onboarded (bool), postal_code, last_seen_at, is_demo (all three private),
                    created_at, updated_at
categories          id, slug, name, is_active, sort_order
skills              id, slug, name, category_id (nullable = universal), is_active
profile_categories  profile_id, category_id                 (PK both)
profile_skills      profile_id, skill_id, kind              (PK all three)
swipes              swiper_id, target_id, direction, created_at   (PK swiper_id+target_id)
matches             id, user_a, user_b, created_at          (CHECK user_a < user_b, UNIQUE pair)
                    conversation_id (FK, unique), unmatched_at (nullable), unmatched_by (nullable)
conversations       id, created_at, type ('direct' | 'group'), archived_at (nullable)
conversation_participants  conversation_id, user_id, joined_at, left_at (nullable)   (PK conversation_id + user_id)
messages            id, conversation_id, sender_id, body, created_at
                    (until 2026-09-20 messages pointed at a match; that column is gone)
journeys            id, name (1-60), goal (<=280, nullable), created_by, conversation_id (FK, unique, the GROUP conversation), created_at, archived_at
journey_members     journey_id, user_id, status ('invited' | 'active'), invited_by, joined_at, left_at   (PK journey_id + user_id)
journey_links       id, journey_id, added_by, title (1-60), url (https:// only, <=500), kind (whatsapp|discord|x|drive|website|other), visibility (private|public, stored for later; every link is members-only today)
blocks              blocker_id, blocked_id, created_at      (PK both)
reports             id, reporter_id, reported_id, reason, details, created_at
```

Fixed option sets are `text` (or `text[]`, "select all that fit") columns with `CHECK` constraints, not Postgres enums. Changed 2026-09-19 (Elie): most answers are now lists.

| Column | Allowed values | Label shown to users |
|---|---|---|
| `work_modes` (list, at least 1) | `remote`, `local` | Remote / Local. Pick both to reach the widest pool. |
| `country` | 2-letter capital code, e.g. `FR` (list in `src/lib/countries.ts`) | Country dropdown, asked of everyone |
| `city`, `district` | free text (max 100). City required if `local` is picked | City or village / District or arrondissement (optional, shown on the card, not used for matching) |
| `postal_code` | 5 digits; **required for Local profiles in France**; PRIVATE (never shown, never returned by the feed) | Code postal, only used to work out the matching zone |
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
- Chat rules (built 2026-09-20): a conversation is readable by its current participants, except between two people where one blocked the other (a block hides it from both); writable only while not archived. Unmatch marks the match (`unmatched_at`, `unmatched_by`) and archives the conversation, deleting nothing. When someone deletes their account their participant row and **their own messages** are deleted (right to erasure); the other person keeps the conversation, archived and read-only, showing "Utilisateur supprimé" with no photo; when nobody is left the conversation is deleted. Profile visibility between chat partners follows the conversation, so after an unmatch the archived chat still shows name and photo.
- Every foreign key pointing to a user uses `ON DELETE CASCADE`.

### Seed data (`supabase/seed.sql` or a seed migration)

Categories (slug, name, sort order), all **active** since 2026-09-19 (migration `20260919210000_open_all_categories.sql`):
1. `local_services`, **Local services & trades** (trades were folded into it, Elie's decision)
2. `food`, Food
3. `ecommerce`, E-commerce
4. `content_media`, Content/media
5. `apps_software`, Apps/software
6. `video_games`, Video games
7. `other`, Other (no skills of its own; shows the universal ones)

Universal skills (`category_id` null, 9): Marketing, Community management, Sales, Finance/admin, Project management, Business planning, Legal & business registration, Branding & design, Website & online presence.

Skills per category (51):
- Local services & trades (14): Hands-on service work, Scheduling & dispatch, Quoting & estimating, Customer service, Local marketing, Vehicles & equipment, Insurance & permits, Licences & safety compliance, Plumbing, Electrical, Carpentry, Painting & finishing, Tiling & masonry, Heating & air conditioning.
- Food (8): Cooking & recipe development, Baking & pastry, Food safety & hygiene rules, Sourcing & suppliers, Front of house & service, Food photography, Packaging & labelling, Events & catering.
- E-commerce (8): Product sourcing, Online store setup, Product photography, Copywriting, Paid ads, Logistics & fulfilment, Customer support, Inventory & pricing.
- Content/media (6): Writing & editing, Video editing, Photography, Podcasting & audio, Social media content, Graphic design.
- Apps/software (6): Web development, Mobile app development, UX/UI design, Data & analytics, Software testing, Hosting & DevOps.
- Video games (9): Game programming, Game design, Level design, 2D art, 3D art, Animation, Audio/music, Writing/narrative, QA/testing.

Draft lists written by Claude and approved in principle by Elie; edit them freely as rows of `skills` (no code change).

**PROPOSED category list for the Île-de-France launch (Elie, 2026-09-20). The migration is written in `supabase/proposed/20260920140000_categories_fr.sql` (NOT in `supabase/migrations/`, so it is not applied) and passed a rolled-back dry run: 9 active categories, 67 skills, all 60 existing skill slugs covered. It waits for Elie's yes because it renames and moves existing rows. Names are French. Mapping from today's rows:**
1. Services locaux (`local_services`, renamed from "Local services & trades")
2. Artisanat & BTP (NEW, `artisanat_btp`; takes the trade skills back out of Services locaux: plumbing, electrical, carpentry, painting & finishing, tiling & masonry, heating & air conditioning, licences & safety compliance)
3. Restauration & alimentation (`food`, renamed from "Food")
4. E-commerce (`ecommerce`, unchanged)
5. Commerce de proximité (NEW, `commerce_proximite`; needs its own draft skills)
6. Contenu & médias (`content_media`, renamed from "Content/media")
7. Applis & logiciels (`apps_software`, renamed from "Apps/software")
8. Jeux vidéo (`video_games`, renamed from "Video games")
9. Autre (`other`, renamed from "Other")
All nine active. This supersedes the earlier decision to fold trades into "Local services & trades". Skill names are translated to French by the same migration (Elie's answer 1). Until it is applied, category and skill names still show in English inside the French app (DEBT-024).


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
│  │  ├─ matches/[conversationId]/page.tsx   chat (+ actions.ts: sendMessage, unmatch)
│  │  ├─ profile/page.tsx
│  │  ├─ settings/page.tsx            block list, delete account
│  │  ├─ privacy/page.tsx
│  │  ├─ manifest.ts
│  │  └─ layout.tsx
│  ├─ components/
│  ├─ lib/
│  │  ├─ supabase/                    client.ts, server.ts, middleware helpers
│  │  ├─ messages/                    fr.ts (ALL text), index.ts
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
| F5 | Mutual-match trigger and matches list | Two test accounts liking each other both see the match (built, awaiting Elie's confirmation) |
| F5b | **Category reseed** to the nine-category Île-de-France list, French names for categories and skills (data). PREPARED in `supabase/proposed/`, dry run passed, **waiting for Elie's yes** | Categories and skills shown in French; needs Elie's approval before applying |
| F6 | **Chat on the conversations model** (built 2026-09-20): migration, realtime 1:1 chat, unmatch (archives the conversation read-only), "Utilisateur supprimé" for deleted accounts | Messages appear live in two browser windows; unmatching archives the chat for both (Elie still has to confirm) |
| F7 | Block and report (built 2026-09-21): a block also unmatches and hides both users from each other, messages are kept; reasons list + optional details; block list with unblock in `/settings` | A blocked user disappears from the feed and matches; reports are stored (Elie still has to confirm) |
| F7b | **Launch metrics** (built 2026-09-20): `profiles.last_seen_at` (touched at most hourly), `is_demo`, and the three admin-only SQL views | Exact SQL given to Elie; each view returns sensible rows in the SQL editor |
| P1 | **Parcours v1** (built 2026-09-21, Elie's core concept, Phase 2 Teams pulled forward at his request): a match becomes a group with a group chat, "Nos outils" links and invitations of your other matches; 1:1 chat unchanged | Two accounts: one starts a parcours from a conversation, the other accepts; both chat and share links; a third match can be invited; leaving works (not yet confirmed by Elie) |
| F8 | Account deletion, **French privacy page** (with the acquisition clause, marked "pending legal review"), landing-page pricing line (French) | Deleting an account removes all of that user's rows; the privacy page and landing line are live |
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

- Profile redesign and audience pivot (validated by Elie 2026-09-20: "Test is validated"; he did not itemise, and the database backs it for John's account, which finished the new form and picked the new categories). Elie's own account is still not onboarded (no country), so it does not appear in feeds yet.

- F5 — Mutual-match trigger and matches list (validated by Elie 2026-09-21: "matched and sent a message, it's all good"). Database evidence: John (liked Marco Demo earlier) and Marco Demo matched at 20:21 UTC on 2026-09-21 and one message was sent from Marco's side. Built with migration `20260919200000_mutual_match_trigger.sql`, then rebuilt on conversations on 2026-09-20. **Not yet confirmed by him:** receiving the message on the other side, live delivery in two windows, unmatch, phone layout (all on his list below).

**In progress:** P1 — **Parcours v1** (Elie's core concept, 2026-09-21). Built and applied 2026-09-21 (migration `20260921110000_journeys.sql`, new tables only, no existing data touched; the two helper functions `is_conversation_reader` and `is_match_partner` were extended). Test script 367/367 (79 new checks: start/accept/decline/invite/leave, limits, blocks, https-only links, archive with fewer than 2 active members, group chat privacy, account deletion). Browser-tested by me with three throwaway users (deleted): start from a conversation, invited person sees only name and goal until accepting, accept, group chat with sender names, links (javascript: and http:// refused, "chat.whatsapp.com/..." gets https:// added, links open in a new tab), invite a second match, rename, leave, archived view read-only. NOT yet confirmed by Elie. Elie's choices: name "Parcours"; v1 = group chat + links + invite your matches; one person starts and the other accepts; the 1:1 chat stays untouched. Not in v1 (Backlog): public parcours pages/recruiting, projects, roles, editing/reordering links, notifications.

**Also, F7 — Block and report.** Built and applied 2026-09-21 (migration `20260921100000_block_report.sql`); security/chat/block test script 288/288; browser-tested by me with three throwaway users (deleted): report from a conversation (reason + details, stored, readable in `admin_reports`), block from a conversation (match marked ended by the blocker, conversation archived, messages kept, redirect to the matches list), block list in `/settings` with unblock, block of a stranger straight from the swipe feed, and the blocked person's side (hidden, no notice). NOT yet confirmed by Elie. Also waiting on Elie: his yes on the French category migration (`supabase/proposed/`).

**Also built on 2026-09-20 after Elie's answers, tested by me and NOT yet confirmed by him:** (1) French-only UI with one messages file; (2) postal code + Île-de-France zone matching (migration `20260920100000`); (3) chat on conversations, live messages, unmatch, "Utilisateur supprimé" (migration `20260920110000`); (4) launch metrics: `last_seen_at` (hourly), `is_demo`, 3 views, backfill of the 4 accounts (migration `20260920120000`); (5) private columns (migration `20260920130000`, applied after the new code was live); (6) landing page pricing line with **100** founding members, French not-found and error pages. Security/feed/chat/metrics test script: 253/253. Browser-tested by me with throwaway users (deleted): French onboarding with the postal-code rules, feed zones, mutual match, live delivery of a message sent from another connection, unmatch (chat archived, nothing deleted), deleted-account display, last-seen throttle; production smoke test (login, feed, profile, matches, French 404). NOT done: the French category/skill data (waiting for Elie), the privacy page (F8).

Rule for schema changes: all table/column/policy changes go through a new numbered file in `supabase/migrations/`, never through the Supabase dashboard's Table Editor (dashboard edits are not recorded in the repo and new columns would miss the grants). Editing data rows in the dashboard (e.g. flipping `categories.is_active`, adding skills) is fine.

How to work with the database from here (no Docker, no password prompt needed once linked and logged in):
- Apply migrations: `npx supabase@2.117.0 db push` (preview first with `--dry-run`)
- Run the security tests: `npx supabase@2.117.0 db query --linked -f supabase/tests/rls_smoke_test.sql` (it always ends with a deliberate "error" that holds the PASS/FAIL report and rolls everything back)
- Automatic security check: `npx supabase@2.117.0 db advisors --linked`
- Every new migration must also revoke default grants and grant only what is needed, then enable RLS (see migration 2).

**Next planned step:** Elie's feedback on Parcours v1, his yes or changes on the French category migration (`supabase/proposed/`), then his real-account tests (see Pending tests). After that F7 (block and report: a block also unmatches and hides both users from each other; the database rules for reading are already block-aware) and F8 (account deletion, privacy page, see DEBT-021 BLOCKER).

**Elie's answers of 2026-09-20 to the open questions** (all applied above; each also has a Decision Log entry):
1. French only for the launch, skill names included; one French messages file, no i18n library.
2. Postal code (5 digits, required for Local in France, never displayed); IDF = 75, 77, 78, 91-95, one zone; outside IDF match by department; accept all sign-ups.
3. Founding members: **100** everywhere.
4. Unmatch as proposed (kept as `unmatched_at`, archived read-only chat, block archives and hides from both); a deleted account shows "Utilisateur supprimé" with no photo.
5. Privacy page in F8 with account deletion; **BLOCKER** DEBT-021 until it is live.
6. `last_seen_at` backfill approved for the 4 accounts; `is_demo` on profiles, set for the 2 demos, excluded from all three metrics views.
Migrations approved by Elie: B, C, D and the postal-code field. **Not approved yet: A (French category and skill data).**

**Metrics: how Elie reads them.** In the Supabase dashboard open **SQL Editor**, paste one line and press Run (the views cannot be read by the app or by users):
```sql
select * from public.metrics_active_profiles;
select * from public.metrics_weekly_matches order by iso_week desc;
select * from public.metrics_retention_30d order by signup_week desc;
```
- `metrics_active_profiles`: people seen in the last 30 days, by region (`ile_de_france`, `local_hors_ile_de_france`, `remote_uniquement`, `profil_incomplet`). Demo profiles are excluded.
- `metrics_weekly_matches`: new matches per ISO week (a match counts even if it was unmatched later; a match disappears from the history if one of the two people deletes their account).
- `metrics_retention_30d`: per signup week, how many signed up, how many were seen again 30 or more days after signing up, and the percentage. Only weeks that ended at least 30 days ago appear, so it stays empty for the first weeks.

**Reports: how Elie reads them.** In the Supabase SQL editor run `select * from public.admin_reports;` (newest first). Columns: date, reason (`fake_profile`, `harassment`, `inappropriate`, `spam`, `underage`, `other`), details, and the names and emails of the reporter and of the reported person. Only the database owner can read it; no app user can. Nothing acts on a report automatically: reviewing them and deciding what to do is manual for now. The reason list lives in `src/lib/validation/safety.ts` and the French words in `src/lib/messages/fr.ts` (Claude proposed the six reasons; Elie can change them).

Notes for later features:
- F4: `get_feed()` must be `SECURITY DEFINER` with a fixed `search_path` (users cannot read other people's profiles directly); it must return the candidate's skills/categories and enough info to build a signed photo link (`avatar_path`), and signed links for other people's photos are created server-side.
- F8: deleting an auth user does NOT delete Storage files. The delete-account code must first remove everything under `avatars/{user_id}/` (with the secret key), then delete the user. Add a test.
- F6: the plain Node 20 runtime has no built-in WebSocket; Next.js/Vercel handle it, but check realtime works in local dev on Node 20.

**Pending tests for Elie** (a feature is only complete when he confirms it; Elie said on 2026-09-21 he will do these later). Mirrored in Claude's memory file `project_pending-tests-for-elie.md`. Tick each one here when he confirms it.
Waived by Elie on 2026-09-19 (not to be re-asked unless he raises them): photo upload from his phone and the F3/F4 phone layout checks.

Confirmed so far: F0 to F4, password login, profile redesign, audience pivot (see Completed features); on 2026-09-21 the mutual match between John and Marco Demo and sending a message.

To do, in this order (demo logins: Ana and Marco were given to Elie in chat):
1. **Chat, both sides and live.** Open the John–Marco conversation in two windows (a private window for the second account). Write from each side: the message must appear in the other window without reloading; the "Matchs" list shows the conversation.
2. **Unmatch.** In the conversation press "Retirer ce match", first Annuler (nothing changes), then confirm: the chat becomes read-only for both, nothing is deleted, and it moves to "Conversations archivées".
3. **Elie's own account** (khoury.elie@live.com): still not onboarded. Log in, finish the profile (pick a country, and a postal code if Sur place + France). Then Ana Demo (who already liked it) gives an instant match.
4. **Postal code and zones.** Two accounts set to "Sur place" in France, for example 75011 and 92100: they see each other. Elsewhere in France they match only in the same department. The postal code is never shown, only the city.
5. **Launch metrics.** In the Supabase SQL editor run the three lines from "Metrics: how Elie reads them" above and check the numbers.
6. **Landing page and French text**: the French text, the "100 premiers membres fondateurs" line, and that no English text remains except category and skill names (DEBT-024, until the French data migration is applied).
7. **Phone layout** of everything new (French screens, form, chat, match screen).
8. **F2 leftovers:** opening an email login link in a different browser (expects the "same browser" message); whether Outlook link scanning uses up the link; the "Forgot your password?" email link.
9. **Drag-to-swipe on a phone** (waived, only if he wants it).
10. **Block and report** (built 2026-09-21, tested only by me): under a swipe card and on a conversation, "Plus d'options" offers "Signaler ce profil" (pick a reason, optional details, then "Envoyer le signalement", which offers to block too) and "Bloquer ce profil" (asks first, Annuler changes nothing). After a block: the person disappears from the feed and from Matchs, the chat can no longer be opened, and the blocked person is not told anything. `/settings` ("Réglages et personnes bloquées" on the profile page) lists blocked people with "Débloquer"; unblocking does not bring a match back. Then read the report in the Supabase SQL editor (see "Reports: how Elie reads them"). Use the demo accounts, not real people.
11. **Parcours** (built 2026-09-21, tested only by me): open a conversation with a match and press "Lancer un parcours" (name + goal); the other account sees it under "Parcours > Invitations" (only name and goal until "Rejoindre"); after joining both see the members, the group chat (names above the other person's messages, live), and "Nos outils" (add a WhatsApp/Discord/X/Drive/site link: only https:// works, it opens in a new tab); invite a third match; leave; with fewer than 2 members left the parcours becomes read-only ("Archivé"). The 1:1 chat must be unchanged. Phone layout unchecked.
12. New items get added here when the next feature ships.

**Demo accounts** (created 2026-09-20 at Elie's request, through the real sign-up path, so he can see cards, skills and matching while testing; logins were given to him in chat only, never stored in files):
- `demo.ana@demo.invalid` "Ana Demo": Lyon (Part-Dieu), France; Remote + Local; all 7 categories; all 4 idea options with a pitch (bakery + repair service); 3 hour ranges, 2 partner ranges, all 3 ambitions; offers 12 skills, seeks 6; has a photo. **Has already liked both real accounts** (Elie and John), so liking her back gives an instant match.
- `demo.marco@demo.invalid` "Marco Demo": Lyon (Croix-Rousse), France; Remote + Local; all 7 categories; all 4 idea options with a pitch (leather goods shop + market stall); 3 hour ranges, 3 partner ranges, all 3 ambitions; offers 11 skills, seeks 6; has a photo. Has liked nobody, so liking him gives no match until he likes back.
- Since 2026-09-20 both have postal codes (69003 and 69004) and `is_demo` = true (excluded from the metrics). They are in Lyon, so outside the Île-de-France zone: Local people in Paris will not see them, but Remote people will. Say the word if you want them moved to Paris-area addresses.
- Both appear in the feed of any onboarded account that shares a category and a way of working (both are Remote, and both are Local in Lyon). Nothing here is real data. See DEBT-019 for cleanup.

**Ideas file:** `ideas.txt` in the project root is Elie's private scratchpad for future ideas. It is git-ignored (never committed). Read it at the start of each session; move anything worth keeping into the Backlog below, in Elie's words.

**Backlog (post-MVP):**
- **Phase 2 – Teams** (Elie, 2026-09-20; v1 was pulled forward on 2026-09-21 as "Parcours", see P1 and the Decision Log; everything below that v1 does not include stays here):
  - A match can become a team; teams recruit new members via matching; team chat uses conversations of type `group`.
  - Team page with "Our tools": saved external links (WhatsApp, Discord, X, Google Drive, website, other). Private invite links (WhatsApp, Discord, Drive) are visible to team members only; public links (X, website) to everyone. HTTPS links only; open in a new tab with `rel="noopener noreferrer"`.
  - Projects belong to a team; ending a project never ends the team or the match.
  - Mutual structured double-blind project reviews, neutral outcome field, evidence links, SIRET verification badge. **Requires legal review before shipping** (DEBT-020).
- **Pricing** (activates at a data-driven decision gate, not before; do NOT build now):
  - Individual Premium €9.99/month: unlimited views and likes, see who liked you, priority placement. Free tier: limited daily views and likes; track records always visible to all. Note: "see who liked you" contradicts today's privacy rule that nobody sees anyone's swipes, so it needs an explicit policy and RLS decision when it is built.
  - Team plan (price TBD): priority in feeds, open roles, advanced team features.
- **Rejected, never build** (Elie): native calls, video calls, document sharing.
- Place search with suggestions (autocomplete from an outside service) for a canonical city, spelling variants across languages, and distance/radius matching later. Kept out of the MVP; today's city is free text compared ignoring capitals/accents/spaces. (Elie chose the simple version, 2026-09-19)
- Broader "Haves and Needs" beyond skills (e.g. capital, network, equipment, domain expertise), and industry-specific haves/needs grouped per industry when more categories open. Elie: fine as game-design skills only for now. The categories/skills tables already support per-industry skills; this is about widening what people can offer or seek. (Elie, 2026-09-19)
- Collaboration type / capital search: whether someone wants paid help (freelance, for cash) or a true partner who works for a share of the venture. The equity partner is the original vision of the app; the paid-help side is an interesting extension. Likely a profile field plus a search filter. (From ideas.txt, 2026-09-19)
- Custom email (SMTP) for login: removes the 2-emails-per-hour limit, allows a proper branded email template, and fixes the login link only working in the browser that requested it. See DEBT-001. Elie: fine for now, fix later (re-check at F5, which needs two accounts)
- Email/push notifications on new match (first priority after MVP)
- Easier discovery beyond swipe-style matching (browse/search profiles; revisit the strict profile-visibility rule). Elie: "we are not strictly a dating app"
- Compatibility-ranked feed (can use `weekly_hours` vs `partner_weekly_hours`)
- Radius/map search for local projects
- Group teams (3+ people), project pages: see Phase 2 – Teams below

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
- 2026-09-19 | F5 matching: a database trigger (`create_match_on_mutual_like`, SECURITY DEFINER, fixed search_path) creates the `matches` row in the same transaction as the second like; it takes a short per-pair advisory lock first so two simultaneous likes cannot both miss each other (a race that the brief's design would otherwise allow); only likes count (a pass never matches); both must be onboarded and not blocked either way; the pair is stored in a fixed order. The app shows "It's a match!" on the second like, a `/matches` list and a `/matches/[id]` page with the other person's profile | Matching in application code; no lock | Atomic and race-free per the brief, plus guards for blocks and unfinished profiles
- 2026-09-19 | **Audience pivot** (Elie): the main context is now first-time founders who want to start a small, non-tech business (local services, trades, food, e-commerce), plus remote-OK profiles; **all seven categories are open** (including Video games and Apps/software); trades are folded into "Local services & trades" rather than being their own category; the matching rule is unchanged (a local founder who also ticks Remote sees remote helpers, both boxes are pre-ticked, and the form and landing page now say remote helpers are welcome). Category skills were drafted and added (51 skills across 5 categories plus 4 new universal ones); the profile form groups skills under "For any business" and one heading per chosen category. Landing page text rewritten | Keeping Video games as the only open category (the original launch plan, an empty-feed guard); a separate Trades category; letting Local-only founders see Remote-only helpers | Elie's call. Trade-off to watch: with 7 open categories and few users, people spread thinly and some feeds will be empty (the original reason for launching with one category). Existing test profiles chose Video games only
- 2026-09-20 | **A. Launch audience** (Elie): first-time founders wanting to start a small, non-tech business (local services, trades, food, e-commerce); all categories open; region Île-de-France plus remote-OK profiles. Category list stays data-driven (no code change to add one). Seed list (French): Services locaux, Artisanat & BTP, Restauration & alimentation, E-commerce, Commerce de proximité, Contenu & médias, Applis & logiciels, Jeux vidéo, Autre. Replaces the indie-game seed and the earlier "trades folded into Local services" choice | Keeping "Local services & trades" as one category | Elie's call, 2026-09-20
- 2026-09-20 | **B. Matches never expire** (Elie): a match lasts until one user unmatches or blocks; no automatic expiry, no inactivity cleanup. Unmatch removes the match from both lists and archives the conversation read-only, and never deletes messages. Block hides both users from each other, no further contact (F7) | Expiring matches | Elie's call
- 2026-09-20 | **C. Chat data model** (Elie, approved change): conversations with participants instead of one chat per match. `conversations` (id, created_at, type direct|group, archived_at), `conversation_participants` (conversation_id, user_id, joined_at, left_at; PK both), `messages` (id, conversation_id, sender_id, body, created_at). The match trigger creates a `direct` conversation with the 2 participants and stores `conversation_id` on the match. RLS: read only as a current participant (left_at null); write only if the conversation is also not archived. MVP uses `direct` only; `group` is there so Phase 2 teams need no chat rewrite | One chat per match (`messages.match_id`, as built in F1) | No chat rewrite for teams. Affects what is already built: `messages` (empty) changes shape, `matches` gets new columns, the match trigger, the RLS tests and generated types change; needs a migration and Elie's approval before it is applied
- 2026-09-20 | **D. Launch metrics, no new tool** (Elie): `profiles.last_seen_at`, updated at most once per hour when the user opens the app; three admin-only SQL views: `metrics_active_profiles` (profiles seen in the last 30 days, by region: Île-de-France vs remote), `metrics_weekly_matches` (new matches per ISO week), `metrics_retention_30d` (per signup week, % of users seen again 30+ days after signup). Elie gets the exact SQL to read each view in the Supabase SQL editor | An analytics service | Zero cost, zero new dependency. Region needs the Île-de-France answer in "Open questions"
- 2026-09-20 | **E. Pricing at launch** (Elie): MVP 100% free, no payment code, no Stripe. Landing-page line (French): "Gratuit pendant toute la phase de lancement. Les 120 premiers membres fondateurs recevront 12 mois de Premium offerts lorsque l'offre payante arrivera." Founding members = first 100 accounts by `created_at`; no flag is built now, it is computable later. **CONFLICT to resolve before the line is published: 120 in the wording vs 100 in the definition** (Open question 3). The promise needs legal review (DEBT-020)
- 2026-09-20 | **F. Privacy policy clause** (Elie, French, pending legal review; to be added to the privacy page with a code comment saying so): "En cas de cession, fusion ou acquisition de tout ou partie du service, les données personnelles des utilisateurs pourront être transférées à l'acquéreur, qui sera tenu de respecter la présente politique. Les utilisateurs en seront informés au préalable et pourront supprimer leur compte à tout moment." The clause promises account deletion at any time, so the page ships with F8 (account deletion)
- 2026-09-20 | **Answers to the open questions** (Elie): (1) French only for launch, skill names included, ONE French messages file, no i18n library so English can be added later without refactoring; (2) postal code field (5 digits, validated, required for Local in France, never displayed to others: only the city is shown), IDF = departments 75, 77, 78, 91, 92, 93, 94, 95, all of IDF is one Local zone, outside IDF Local matching is by department, accept all sign-ups; (3) founding members = 100 everywhere; (4) unmatch as proposed, plus a deleted account shows "Utilisateur supprimé" with no photo; (5) privacy page in F8, BLOCKER until then; (6) `last_seen_at` backfill approved, `is_demo` flag excluded from all three metrics views | Restricting sign-ups to IDF; a separate region field | Elie's call
- 2026-09-20 | **How the answers were built** (Claude): the postal code is a column on `profiles` (so the database CHECK can require it) made unreadable to other users by column-level privileges, read by its owner through `get_my_postal_code()`; the same privileges hide `last_seen_at` and `is_demo`; reading a conversation also stops when either person blocked the other; a deleted person's own messages are erased with the account while the other person keeps the archived conversation; "last seen" is written from the proxy at most once an hour per person and browser (cookie holds the person's id) and once an hour in the database; the metrics views are `security_invoker` with no access for app roles, so only the SQL editor can read them | Storing the postal code in a separate private table; keeping a deleted person's messages (see DEBT-023) | Keeps every rule in the database; smallest change to the code
- 2026-09-20 | **Not applied yet: French category and skill data** (Elie's decision A + answer 1). Written, dry-run-tested and kept in `supabase/proposed/20260920140000_categories_fr.sql` because it renames/moves existing rows and was not on the list of approved migrations | Applying it with the others | Elie's rule: ask before any migration that alters existing data
- 2026-09-21 | **F7 block and report** (Claude's design, per Elie's plan of a block that hides both users from each other with no further contact): a trigger on `blocks` ends any match between the two people (`unmatched_at`/`unmatched_by`) and archives their conversation, so it works however a block is recorded; reading conversations and profiles was already refused between blocked people (F6), the feed and the match trigger already skipped them; the blocked person is never told; unblocking removes the block but a match that was ended stays ended (they can only meet again in the feed if they never swiped on each other); `get_blocked_profiles()` (definer) feeds the block list because a block hides the other person's profile from you too; reports are stored with a short reason key plus optional details and are read only through the admin-only view `admin_reports`; the menu sits under swipe cards and on conversations | Deleting the match and messages on block (breaks the archive rule); letting the reported person see they were reported | Elie's rule: nothing is deleted, nobody is notified
- 2026-09-21 | **Parcours v1** (Elie: "turn a match into a group... a more powerful chat, with stored links"; answers: name Parcours, v1 = group chat + links + members invite their matches, one person starts and the other accepts, 1:1 chat untouched). Claude's design, migration `20260921110000_journeys.sql`: a parcours owns a group conversation (F6 model, type `group`); either matched person starts it and the other is INVITED (nobody is added without saying yes; a decline removes an empty parcours); an active member can invite only people they have an active match with, never someone blocked from or blocking a current member, at most 10 people; leaving keeps everything, and with fewer than 2 active members the parcours and its chat are archived read-only (nothing deleted; also when a member deletes their account); only active members read the parcours, its links and chat; co-members can see each other's profile (blocks respected); all changes to members go through four database functions (start, invite, respond, leave), the tables allow only reading plus editing name/goal and adding/removing links; in a group chat a block between two members does not hide the chat from the others (the 1:1 rule is unchanged); links must be https:// (the form adds it to a bare address; javascript:/http:/spaces refused by the app AND a database CHECK) and open in a new tab with `noopener noreferrer`; `journey_links.visibility` is stored (private for WhatsApp/Discord/Drive/other, public for X/website) but no public page exists yet | Making the parcours from the 1:1 conversation itself (would change the 1:1 chat); adding members without acceptance; open groups anyone can join | Keeps the 1:1 chat safe, no unwanted group adds, small and reviewable. Consequence: an invited stranger appears as "Quelqu'un" to members who did not match them
- 2026-09-19 | Next.js 16.3.5 (React 19, Tailwind 4, ESLint 9) scaffolded with create-next-app; `AGENTS.md` from the scaffold kept (tells AI tools to check bundled Next.js docs) | — | Current stable versions; matches the "check current docs" rule

## Debt Ledger

Tags: `[BLOCKER]` `[HIGH]` `[LOW]`

- [HIGH] DEBT-001 Supabase built-in email: (a) limited to 2 emails per hour for the whole project (docs, 2026-09-19), which limits testing (F5 needs two accounts); (b) email templates cannot be edited without custom SMTP (confirmed by Elie 2026-09-19), so the login link must be opened in the same browser that requested it and mail scanners can use it up. Set up custom SMTP before F5 or before public launch, whichever comes first, then move to a `token_hash` template with a "Log in" button page.
- [LOW] DEBT-010 "At least one offered skill" is enforced by the app only (`saveProfile`), not by the database, because a CHECK cannot look at another table. Anyone calling the API directly could finish onboarding with no skills. Add a trigger if this matters.
- [LOW] DEBT-011 `saveProfile` is several separate database calls, not one transaction. If one fails midway the person is asked to save again (the profile row is saved last, so `onboarded` never flips early). Convert to a single database function if it ever causes real problems.
- [LOW] DEBT-012 Photo links are readable by any logged-in user who knows the exact file path (path contains two random IDs). Accepted for the MVP per the brief; revisit with the profile-visibility rule.
- [HIGH] DEBT-013 Passwords are now the main login (2026-09-19). Supabase advisor warns "leaked password protection disabled" (checks passwords against known breaches; may need a paid Supabase plan, check current docs). App-side rules today: 8 to 72 characters, current password required to change it. Revisit before public launch.
- [HIGH] DEBT-017 If Supabase "Confirm email" is switched OFF (so accounts can be created without email, which Elie wants while the email limit exists), anyone can register with an address they do not own; no email is ever verified, and there is no password reset except the email-link fallback (which needs working email, DEBT-001). Fine for private testing. Before public launch: turn "Confirm email" back ON and set up custom SMTP (DEBT-001). Also clean out any accounts made with fake addresses.
- [HIGH] DEBT-019 Two demo accounts exist (`demo.ana@demo.invalid`, `demo.marco@demo.invalid`, see Demo accounts) with passwords known to Elie and unverified fake addresses. Delete them before public launch, together with any other test accounts. Deleting an auth user does NOT delete their Storage photo: first remove `{user_id}/demo-photo.png` from the `avatars` bucket (sign in as the demo account and use the Storage API, or use the secret key once DEBT-008 is fixed), then delete the users (`delete from auth.users where email like '%@demo.invalid'`), which cascades everything else. Their swipes/matches with real accounts disappear with them.
- [HIGH] DEBT-020 Legal review needed before these go public (what gets written here is not legal advice, see DEBT-004): the French "acquisition" clause in the privacy policy; the landing-page promise of 12 months of free Premium for founding members (number conflict 120 vs 100 is open); and, in Phase 2, double-blind reviews, evidence links and the SIRET badge.
- [BLOCKER] DEBT-021 **No public sign-up and no launch before the privacy page is live** (Elie, 2026-09-20). The page is built in F8 with account deletion and contains the French acquisition clause (marked "pending legal review"). Note: sign-up is technically open today (the site is public and "Confirm email" is off, DEBT-017); nothing has been promoted. If the address is going to be shared before F8, close sign-ups first (Supabase, Authentication, Sign In / Providers, "Allow new users to sign up").
- [HIGH] DEBT-022 The privacy page text, the terms and an age rule (18+) do not exist yet; see DEBT-004 and DEBT-020.
- [HIGH] DEBT-023 When someone deletes their account their own chat messages are deleted with it (right to erasure) and the other person keeps the rest of the archived conversation. That choice needs legal review: the alternative is to keep the messages anonymised ("Utilisateur supprimé").
- [LOW] DEBT-024 Category and skill names are still in English in the database until the French migration is applied (`supabase/proposed/`), so the French app shows English category and skill names for now.
- [LOW] DEBT-028 Parcours links are not checked: an https:// address is accepted as typed (no scan for phishing or malware), shown only to members and opened in a new tab. Members can add any https link, including a harmful one. Consider adding a short warning before opening external links, and reporting a parcours, before launch.
- [LOW] DEBT-029 Reports (F7) only target a person. There is no way to report a parcours, its chat or a link, and a member who was added by a friend of a blocker still shares the chat with the blocker (a block only hides the profile between two members). Decide before launch.
- [LOW] DEBT-030 A parcours has no roles: any member can rename it, add links and invite (the creator can also remove others' links). No way to remove another member. Fine for small trusted groups; revisit if abuse appears.
- [LOW] DEBT-025 Chat loads at most the latest 500 messages of a conversation and has no "load older" and no typing/read indicators. Fine for the MVP.
- [LOW] DEBT-026 "Last seen" counts a person once an hour per browser; someone using two browsers is counted from whichever opens first. Fine for the launch metrics.
- [HIGH] DEBT-027 Reports are only stored: nobody is alerted and nothing is moderated automatically. Elie has to read `admin_reports` himself. Decide a routine (and, with legal review, what happens to a reported account) before launch. Also no rate limit on reports or blocks yet.
- [LOW] DEBT-018 City and district are free text. The same place written in another language or with a typo (Beirut/Beyrouth, Lyon/Lion) does not match. Country is a fixed list, so only the city part can drift. Fix later with place search (see Backlog).
- [LOW] DEBT-014 Recording a swipe only checks that you are the swiper and the target exists; it does not re-check that the target is in your feed (shared category, work-mode compatibility). Partly fixed in F5: the match trigger only matches people who are both onboarded and not blocked either way. A determined user could still like someone outside their feed, but a match also needs that person to have liked them back.
- [LOW] DEBT-015 Supabase advisor warns that `get_feed` is a SECURITY DEFINER function callable by logged-in users. Intentional and accepted (it is the controlled way to see other people; uses `auth.uid()`, no parameters, returns only card fields). Since 2026-09-20 the same is true, and equally accepted, for `is_match_partner`, `is_conversation_reader`, `can_write_conversation`, `get_my_postal_code`, `touch_last_seen` and `unmatch` (each checks `auth.uid()` and returns or changes only what that person may).
- [LOW] DEBT-016 Swipes cannot be undone and there is no "seen you already" review list. A mis-tap is permanent. Consider an undo for the last swipe after the MVP.
- [HIGH] DEBT-009 On iPhones an installed PWA has separate storage from Safari, so a magic link opened from the mail app logs the user in in Safari, not inside the installed app. Decide before F9 whether to add a 6-digit code option (needs a custom email template, so needs custom SMTP first, see DEBT-001).
- [HIGH] DEBT-002 Vercel Hobby plan is for non-commercial use. Move to Pro before monetising (check current terms).
- [LOW] DEBT-003 Supabase free tier pauses inactive projects. Expect to unpause the dev project between sessions (check current policy).
- [HIGH] DEBT-004 Privacy policy and terms (including an 18+ age rule) need a real review before launch. What gets drafted here is not legal advice.
- [LOW] DEBT-005 `npm install` warns that ESLint 9.39.5 is no longer supported. Upgrade when `eslint-config-next` supports the newer major.
- [LOW] DEBT-006 `globals.css` sets body font to Arial, overriding the Geist font the scaffold loads. Decide on the app font during UI work.
- [HIGH] DEBT-008 `SUPABASE_SECRET_KEY` in `.env.local` was rejected (HTTP 401) by the Supabase admin API on 2026-09-19; the publishable key and URL work. Cause unknown (possible copy error or key format). Re-copy the secret key from Supabase Settings > API Keys and re-test before F8.
- [LOW] DEBT-007 Unused scaffold images remain in `public/` (next.svg, vercel.svg, etc.). Remove during cleanup.
