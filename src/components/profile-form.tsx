"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/profile/actions";
import type { ProfileFormData } from "@/lib/profile-data";
import {
  AMBITIONS,
  IDEA_STATUSES,
  PITCH_MAX_LENGTH,
  WEEKLY_HOURS,
  WORK_MODES,
} from "@/lib/profile-options";
import { PhotoField } from "./photo-field";

const initialState: ProfileFormState = { status: "idle" };

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

function Section({
  legend,
  hint,
  error,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-zinc-500">{hint}</p>}
      {children}
      <FieldError message={error} />
    </fieldset>
  );
}

// One tappable answer. Works for radio buttons (pick one) and checkboxes (pick several).
function Choice({
  type,
  name,
  value,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string | number;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-10 items-center rounded-full border border-zinc-300 px-4 py-1.5 text-sm peer-checked:border-transparent peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-500 dark:border-zinc-700">
        {label}
      </span>
    </label>
  );
}

function toggle(list: number[], id: number) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function ProfileForm({
  mode,
  data,
}: {
  mode: "onboarding" | "edit";
  data: ProfileFormData;
}) {
  const { profile, categories, skills, avatarUrl } = data;
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const errors = state.fieldErrors ?? {};

  // All fields are controlled so nothing typed is lost if saving fails.
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [workMode, setWorkMode] = useState(profile.work_mode ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [ideaStatus, setIdeaStatus] = useState(profile.idea_status ?? "");
  const [pitch, setPitch] = useState(profile.pitch ?? "");
  const [weeklyHours, setWeeklyHours] = useState(profile.weekly_hours ?? "");
  const [partnerHours, setPartnerHours] = useState(profile.partner_weekly_hours ?? "");
  const [ambition, setAmbition] = useState(profile.ambition ?? "");
  const [categoryIds, setCategoryIds] = useState<number[]>(data.categoryIds);
  const [offers, setOffers] = useState<number[]>(data.offers);
  const [seeks, setSeeks] = useState<number[]>(data.seeks);

  // Universal skills plus the skills of the chosen categories.
  const visibleSkills = skills.filter(
    (skill) => skill.category_id === null || categoryIds.includes(skill.category_id),
  );
  const visibleIds = new Set(visibleSkills.map((skill) => skill.id));
  const onlyOneCategory = categories.length === 1;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <PhotoField currentUrl={avatarUrl} error={errors.avatar} />

      <Section legend="Your name" error={errors.display_name}>
        <input
          name="display_name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="given-name"
          maxLength={50}
          className={inputClass}
          aria-label="Your name"
        />
      </Section>

      {onlyOneCategory ? (
        // Only one category is open, so it is chosen for everyone and the picker is hidden.
        <input type="hidden" name="category_ids" value={categories[0].id} />
      ) : (
        <Section legend="What do you want to build?" error={errors.category_ids}>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Choice
                key={category.id}
                type="checkbox"
                name="category_ids"
                value={category.id}
                label={category.name}
                checked={categoryIds.includes(category.id)}
                onChange={() => setCategoryIds((ids) => toggle(ids, category.id))}
              />
            ))}
          </div>
        </Section>
      )}

      <Section legend="Where can you work?" error={errors.work_mode}>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((option) => (
            <Choice
              key={option.value}
              type="radio"
              name="work_mode"
              value={option.value}
              label={option.label}
              checked={workMode === option.value}
              onChange={() => setWorkMode(option.value)}
            />
          ))}
        </div>
        {workMode === "local_only" && (
          <div className="flex flex-col gap-2">
            <input
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              autoComplete="address-level2"
              placeholder="Your city"
              maxLength={100}
              className={inputClass}
              aria-label="Your city"
            />
            <p className="text-sm text-zinc-500">
              Local-only people are matched with others in the same city.
            </p>
            <FieldError message={errors.city} />
          </div>
        )}
        {/* Remote-OK people can keep a city too; it is just optional. */}
        {workMode === "remote_ok" && <input type="hidden" name="city" value={city} />}
      </Section>

      <Section legend="Where are you with your idea?" error={errors.idea_status}>
        <div className="flex flex-wrap gap-2">
          {IDEA_STATUSES.map((option) => (
            <Choice
              key={option.value}
              type="radio"
              name="idea_status"
              value={option.value}
              label={option.label}
              checked={ideaStatus === option.value}
              onChange={() => setIdeaStatus(option.value)}
            />
          ))}
        </div>
        {ideaStatus === "has_idea" && (
          <div className="flex flex-col gap-2">
            <textarea
              name="pitch"
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
              rows={4}
              maxLength={PITCH_MAX_LENGTH}
              placeholder="Pitch your idea in a few sentences"
              className="w-full rounded-xl border border-zinc-300 bg-transparent p-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
              aria-label="Your pitch"
            />
            <p className="text-right text-xs text-zinc-500">
              {pitch.length}/{PITCH_MAX_LENGTH}
            </p>
            <FieldError message={errors.pitch} />
          </div>
        )}
      </Section>

      <Section legend="Hours per week you can commit" error={errors.weekly_hours}>
        <div className="flex flex-wrap gap-2">
          {WEEKLY_HOURS.map((option) => (
            <Choice
              key={option.value}
              type="radio"
              name="weekly_hours"
              value={option.value}
              label={option.label}
              checked={weeklyHours === option.value}
              onChange={() => setWeeklyHours(option.value)}
            />
          ))}
        </div>
      </Section>

      <Section
        legend="Hours per week you'd like a partner to commit"
        hint="Optional. Full-timers and part-timers can still find each other."
        error={errors.partner_weekly_hours}
      >
        <div className="flex flex-wrap gap-2">
          <Choice
            type="radio"
            name="partner_weekly_hours"
            value=""
            label="No preference"
            checked={partnerHours === ""}
            onChange={() => setPartnerHours("")}
          />
          {WEEKLY_HOURS.map((option) => (
            <Choice
              key={option.value}
              type="radio"
              name="partner_weekly_hours"
              value={option.value}
              label={option.label}
              checked={partnerHours === option.value}
              onChange={() => setPartnerHours(option.value)}
            />
          ))}
        </div>
      </Section>

      <Section legend="How far do you want to take it?" error={errors.ambition}>
        <div className="flex flex-wrap gap-2">
          {AMBITIONS.map((option) => (
            <Choice
              key={option.value}
              type="radio"
              name="ambition"
              value={option.value}
              label={option.label}
              checked={ambition === option.value}
              onChange={() => setAmbition(option.value)}
            />
          ))}
        </div>
      </Section>

      <Section legend="Skills you offer" hint="Pick at least one." error={errors.offers}>
        <div className="flex flex-wrap gap-2">
          {visibleSkills.map((skill) => (
            <Choice
              key={skill.id}
              type="checkbox"
              name="offers"
              value={skill.id}
              label={skill.name}
              checked={offers.includes(skill.id) && visibleIds.has(skill.id)}
              onChange={() => setOffers((ids) => toggle(ids, skill.id))}
            />
          ))}
        </div>
      </Section>

      <Section
        legend="Skills you're looking for"
        hint="Optional."
        error={errors.seeks}
      >
        <div className="flex flex-wrap gap-2">
          {visibleSkills.map((skill) => (
            <Choice
              key={skill.id}
              type="checkbox"
              name="seeks"
              value={skill.id}
              label={skill.name}
              checked={seeks.includes(skill.id) && visibleIds.has(skill.id)}
              onChange={() => setSeeks((ids) => toggle(ids, skill.id))}
            />
          ))}
        </div>
      </Section>

      {state.status === "error" && state.message && (
        <p
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "onboarding" ? "Finish profile" : "Save changes"}
      </button>
    </form>
  );
}
