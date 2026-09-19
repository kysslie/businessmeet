"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/profile/actions";
import { COUNTRIES } from "@/lib/countries";
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

// One tappable answer. Every question in this form is "select all that fit", so these are
// checkboxes shown as pills.
function Choice({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string | number;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
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

type SkillGroup = { title: string; skills: { id: number; name: string }[] };

// Skill pills grouped under headings ("For any business", then one group per chosen category).
function SkillPicker({
  name,
  groups,
  selected,
  onToggle,
}: {
  name: string;
  groups: SkillGroup[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{group.title}</p>
          <div className="flex flex-wrap gap-2">
            {group.skills.map((skill) => (
              <Choice
                key={skill.id}
                name={name}
                value={skill.id}
                label={skill.name}
                checked={selected.includes(skill.id)}
                onChange={() => onToggle(skill.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((existing) => existing !== item) : [...list, item];
}

// A group of pills bound to one list of chosen values.
function ChoiceGroup({
  name,
  options,
  selected,
  onChange,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Choice
          key={option.value}
          name={name}
          value={option.value}
          label={option.label}
          checked={selected.includes(option.value)}
          onChange={() => onChange(toggle(selected, option.value))}
        />
      ))}
    </div>
  );
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
  // New profiles start with both Remote and Local picked: that reaches the most people.
  const [workModes, setWorkModes] = useState<string[]>(profile.work_modes ?? ["remote", "local"]);
  const [country, setCountry] = useState(profile.country ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [district, setDistrict] = useState(profile.district ?? "");
  const [ideaStatuses, setIdeaStatuses] = useState<string[]>(profile.idea_statuses ?? []);
  const [pitch, setPitch] = useState(profile.pitch ?? "");
  const [weeklyHours, setWeeklyHours] = useState<string[]>(profile.weekly_hours ?? []);
  const [partnerHours, setPartnerHours] = useState<string[]>(profile.partner_weekly_hours ?? []);
  const [ambitions, setAmbitions] = useState<string[]>(profile.ambitions ?? []);
  const [categoryIds, setCategoryIds] = useState<number[]>(data.categoryIds);
  const [offers, setOffers] = useState<number[]>(data.offers);
  const [seeks, setSeeks] = useState<number[]>(data.seeks);

  // Universal skills plus the skills of the chosen categories.
  const visibleSkills = skills.filter(
    (skill) => skill.category_id === null || categoryIds.includes(skill.category_id),
  );
  const visibleIds = new Set(visibleSkills.map((skill) => skill.id));
  const skillGroups: SkillGroup[] = [
    { title: "For any business", skills: visibleSkills.filter((skill) => skill.category_id === null) },
    ...categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => ({
        title: category.name,
        skills: visibleSkills.filter((skill) => skill.category_id === category.id),
      })),
  ].filter((group) => group.skills.length > 0);
  const onlyOneCategory = categories.length === 1;
  const wantsLocal = workModes.includes("local");

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
        <Section
          legend="What kind of business or project?"
          hint="Pick all that fit. The skills below follow your choice."
          error={errors.category_ids}
        >
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Choice
                key={category.id}
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

      <Section
        legend="How can you work together?"
        hint="Pick both to reach the most people. Remote helpers are welcome: if you run a local business, tick Remote too to meet people who can help from anywhere."
        error={errors.work_modes}
      >
        <ChoiceGroup name="work_modes" options={WORK_MODES} selected={workModes} onChange={setWorkModes} />
      </Section>

      <Section
        legend="Where are you?"
        hint={
          wantsLocal
            ? "People who pick Local are matched by country and city or village."
            : "Your country helps remote partners see roughly where you are."
        }
        error={errors.country}
      >
        <select
          name="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          autoComplete="country"
          className={inputClass}
          aria-label="Your country"
        >
          <option value="">Choose your country…</option>
          {COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
        <input
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          autoComplete="address-level2"
          placeholder={wantsLocal ? "City or village" : "City or village (optional)"}
          maxLength={100}
          className={inputClass}
          aria-label="Your city or village"
        />
        <FieldError message={errors.city} />
        <input
          name="district"
          value={district}
          onChange={(event) => setDistrict(event.target.value)}
          placeholder="District or arrondissement (optional)"
          maxLength={100}
          className={inputClass}
          aria-label="Your district or arrondissement"
        />
        <FieldError message={errors.district} />
      </Section>

      <Section
        legend="Where are you with your idea?"
        hint="Pick all that fit."
        error={errors.idea_statuses}
      >
        <ChoiceGroup
          name="idea_statuses"
          options={IDEA_STATUSES}
          selected={ideaStatuses}
          onChange={setIdeaStatuses}
        />
        {ideaStatuses.includes("has_idea") && (
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

      <Section
        legend="Hours per week you can commit"
        hint="Pick every range that fits, for example if it may grow."
        error={errors.weekly_hours}
      >
        <ChoiceGroup
          name="weekly_hours"
          options={WEEKLY_HOURS}
          selected={weeklyHours}
          onChange={setWeeklyHours}
        />
      </Section>

      <Section
        legend="Hours per week you'd like a partner to commit"
        hint="Optional. Pick every range you'd be happy with, or leave empty for no preference."
        error={errors.partner_weekly_hours}
      >
        <ChoiceGroup
          name="partner_weekly_hours"
          options={WEEKLY_HOURS}
          selected={partnerHours}
          onChange={setPartnerHours}
        />
      </Section>

      <Section
        legend="How far do you want to take it?"
        hint="Pick all that fit, for example side income first and full-time later."
        error={errors.ambitions}
      >
        <ChoiceGroup name="ambitions" options={AMBITIONS} selected={ambitions} onChange={setAmbitions} />
      </Section>

      <Section
        legend="Skills you offer"
        hint="Pick at least one. The skills shown follow the categories you chose above."
        error={errors.offers}
      >
        <SkillPicker
          name="offers"
          groups={skillGroups}
          selected={offers.filter((id) => visibleIds.has(id))}
          onToggle={(id) => setOffers((ids) => toggle(ids, id))}
        />
      </Section>

      <Section legend="Skills you're looking for" hint="Optional." error={errors.seeks}>
        <SkillPicker
          name="seeks"
          groups={skillGroups}
          selected={seeks.filter((id) => visibleIds.has(id))}
          onToggle={(id) => setSeeks((ids) => toggle(ids, id))}
        />
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
