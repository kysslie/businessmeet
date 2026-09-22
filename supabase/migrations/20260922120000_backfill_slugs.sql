-- Fix: in 20260922110000_portfolio_visibility.sql, the visibility backfill (an UPDATE) ran
-- BEFORE the profiles_assign_slug trigger was created, so already-onboarded accounts never
-- got a slug from it. Touching them again, now that the trigger exists, assigns one the
-- normal way. No other column changes; this is the same kind of "no change in who sees them
-- today" backfill Elie already approved.
update public.profiles set updated_at = now() where onboarded = true and slug is null;
