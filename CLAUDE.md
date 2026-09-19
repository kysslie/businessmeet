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
Supabase: Auth (email magic link) · Postgres with Row Level Security · Realtime (chat) · Storage (profile photos)
```

Key decisions:
- **Row Level Security (RLS) on every table, from the start.** Access rules live in the database. Examples: a user edits only their own profile; reads messages only from matches they belong to; never sees anyone's swipes.
- **Mutual matching happens in a database trigger** on the `swipes` table. When a reciprocal like is inserted, the trigger creates the `matches` row in the same transaction, which avoids race conditions. The trigger needs to read the other user's swipe, which RLS hides, so it should run as `SECURITY DEFINER` with a fixed `search_path`. Keep it minimal.
- **The feed is one Postgres function, `get_feed()`**, called via RPC. It returns up to 20 profiles that:
  - are not the current user and are onboarded;
  - have not already been swiped by the current user;
  - are not blocked in either direction;
  - share at least one **active** category with the current user;
  - are work-mode compatible: remote-OK users see everyone in shared categories; local-only users see only people in the same city (case-insensitive, trimmed text match).
  - Use `auth.uid()` inside the function. Never accept a user id as a parameter.
- **Categories and skills are data, not code.** They live in tables with `is_active`. All categories are seeded; only **Video games** is active at launch. Activating a new category must require **no code change**: flip `is_active` and optionally insert its skills.
  - While only one category is active, the profile form pre-selects it and hides the picker.
  - The skills shown in the form are universal skills (`category_id IS NULL`) plus skills of the categories the user selected.
- **Login is by email magic link only** (no passwords).
- **Profile photos** go in a Storage bucket `avatars`, at path `{user_id}/...`. Users may write only in their own folder. Photos may be readable by logged-in users. Choose the simplest secure option per the current Supabase docs.
- **Chat** uses Supabase Realtime on `messages`, filtered by `match_id`, protected by RLS.
- **Account deletion** runs server-side with the service role key, deleting the auth user. Every user foreign key uses `ON DELETE CASCADE`, so all of their data goes with it (GDPR right to erasure).
- **No Docker.** Development uses a hosted Supabase dev project. Schema changes are numbered SQL migration files in `supabase/migrations/`, applied with the Supabase CLI. Confirm in the current docs that pushing to a linked remote project works without Docker; if it doesn't, tell Elie and propose an alternative before proceeding.

---

## 5. Data model

```
profiles            id (PK, = auth.users.id), display_name, avatar_path, city,
                    work_mode, idea_status, pitch, weekly_hours, ambition,
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

Fixed option sets are `text` columns with `CHECK` constraints, not Postgres enums:

| Column | Allowed values | Label shown to users |
|---|---|---|
| `work_mode` | `remote_ok`, `local_only` | Remote OK / Local only |
| `idea_status` | `has_idea`, `wants_to_join`, `exploring` | I have an idea / I want to join someone's idea / Exploring |
| `weekly_hours` | `lt_5`, `5_10`, `10_20`, `20_plus` | <5 / 5–10 / 10–20 / 20+ |
| `ambition` | `for_fun`, `side_income`, `full_time` | Side project for fun / Side income / Aim to go full-time |
| `profile_skills.kind` | `offers`, `seeks` | — |
| `swipes.direction` | `like`, `pass` | — |

Other rules:
- `pitch`: max 280 characters. Required only when `idea_status = has_idea`.
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
│  │  ├─ auth/callback/route.ts       magic-link handler
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
├─ middleware.ts                      redirects logged-out users
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

**In progress:** F1 — Schema migrations, RLS policies, seed data. Approved by Elie 2026-09-19. Supabase CLI runs via `npx supabase@2.117.0` (not added to package.json).

**Next planned step:** F1 — write migrations, link to the dev project, push, test RLS

**Backlog (post-MVP):**
- Email/push notifications on new match (first priority after MVP)
- Compatibility-ranked feed
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
- 2026-09-19 | Next.js 16.3.5 (React 19, Tailwind 4, ESLint 9) scaffolded with create-next-app; `AGENTS.md` from the scaffold kept (tells AI tools to check bundled Next.js docs) | — | Current stable versions; matches the "check current docs" rule

## Debt Ledger

Tags: `[BLOCKER]` `[HIGH]` `[LOW]`

- [HIGH] DEBT-001 Supabase built-in email has low send limits. Configure custom SMTP before public launch (check current limits).
- [HIGH] DEBT-002 Vercel Hobby plan is for non-commercial use. Move to Pro before monetising (check current terms).
- [LOW] DEBT-003 Supabase free tier pauses inactive projects. Expect to unpause the dev project between sessions (check current policy).
- [HIGH] DEBT-004 Privacy policy and terms (including an 18+ age rule) need a real review before launch. What gets drafted here is not legal advice.
- [LOW] DEBT-005 `npm install` warns that ESLint 9.39.5 is no longer supported. Upgrade when `eslint-config-next` supports the newer major.
- [LOW] DEBT-006 `globals.css` sets body font to Arial, overriding the Geist font the scaffold loads. Decide on the app font during UI work.
- [HIGH] DEBT-008 `SUPABASE_SECRET_KEY` in `.env.local` was rejected (HTTP 401) by the Supabase admin API on 2026-09-19; the publishable key and URL work. Cause unknown (possible copy error or key format). Re-copy the secret key from Supabase Settings > API Keys and re-test before F8.
- [LOW] DEBT-007 Unused scaffold images remain in `public/` (next.svg, vercel.svg, etc.). Remove during cleanup.
