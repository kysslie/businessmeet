"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/profile-options";

export type ProfileFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const GENERIC_ERROR = "We couldn't save your profile. Please try again.";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Which values are in `current` but not in `wanted`, and the other way round.
function diff<T>(current: T[], wanted: T[]) {
  return {
    add: wanted.filter((value) => !current.includes(value)),
    remove: current.filter((value) => !wanted.includes(value)),
  };
}

// Saves the profile form (used by both onboarding and profile edit).
// Order matters: categories, skills and the photo are saved first and the profile row
// last, so if anything fails halfway the person is simply asked to save again.
export async function saveProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  // 1. Check the form input.
  const text = (name: string) => String(formData.get(name) ?? "");
  const parsed = profileSchema.safeParse({
    display_name: text("display_name"),
    work_modes: formData.getAll("work_modes"),
    country: text("country"),
    city: text("city"),
    district: text("district"),
    idea_statuses: formData.getAll("idea_statuses"),
    pitch: text("pitch"),
    weekly_hours: formData.getAll("weekly_hours"),
    partner_weekly_hours: formData.getAll("partner_weekly_hours"),
    ambitions: formData.getAll("ambitions"),
    category_ids: formData.getAll("category_ids"),
    offers: formData.getAll("offers"),
    seeks: formData.getAll("seeks"),
  });

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
  }

  const avatar = formData.get("avatar");
  const newAvatar = avatar instanceof File && avatar.size > 0 ? avatar : null;
  if (newAvatar) {
    if (!(AVATAR_TYPES as readonly string[]).includes(newAvatar.type)) {
      fieldErrors.avatar = "Use a JPEG, PNG or WebP photo.";
    } else if (newAvatar.size > AVATAR_MAX_BYTES) {
      fieldErrors.avatar = "That photo is too large (2 MB maximum).";
    }
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  // 2. Check the chosen categories and skills against what is really available.
  const [activeCategories, activeSkills, current] = await Promise.all([
    supabase.from("categories").select("id").eq("is_active", true),
    supabase.from("skills").select("id, category_id").eq("is_active", true),
    Promise.all([
      supabase.from("profile_categories").select("category_id").eq("profile_id", userId),
      supabase.from("profile_skills").select("skill_id, kind").eq("profile_id", userId),
      supabase.from("profiles").select("avatar_path, onboarded").eq("id", userId).single(),
    ]),
  ]);
  const [currentCategories, currentSkills, currentProfile] = current;
  if (
    activeCategories.error ||
    activeSkills.error ||
    currentCategories.error ||
    currentSkills.error ||
    currentProfile.error
  ) {
    console.error("saveProfile lookup failed");
    return { status: "error", message: GENERIC_ERROR };
  }

  const categoryIds = [...new Set(input.category_ids)];
  const activeCategoryIds = new Set(activeCategories.data.map((category) => category.id));
  const allowedSkillIds = new Set(
    activeSkills.data
      .filter((skill) => skill.category_id === null || categoryIds.includes(skill.category_id))
      .map((skill) => skill.id),
  );
  const offers = [...new Set(input.offers)];
  const seeks = [...new Set(input.seeks)];
  if (
    !categoryIds.every((id) => activeCategoryIds.has(id)) ||
    ![...offers, ...seeks].every((id) => allowedSkillIds.has(id))
  ) {
    return {
      status: "error",
      message: "Some of your choices are no longer available. Please reload the page and try again.",
    };
  }

  // 3. Categories: add new ones first, then remove old ones.
  const categoryChanges = diff(
    currentCategories.data.map((row) => row.category_id),
    categoryIds,
  );
  if (categoryChanges.add.length > 0) {
    const { error } = await supabase
      .from("profile_categories")
      .insert(categoryChanges.add.map((category_id) => ({ profile_id: userId, category_id })));
    if (error) return failed("adding categories", error);
  }
  if (categoryChanges.remove.length > 0) {
    const { error } = await supabase
      .from("profile_categories")
      .delete()
      .eq("profile_id", userId)
      .in("category_id", categoryChanges.remove);
    if (error) return failed("removing categories", error);
  }

  // 4. Skills, offered and wanted.
  for (const [kind, wanted] of [
    ["offers", offers],
    ["seeks", seeks],
  ] as const) {
    const changes = diff(
      currentSkills.data.filter((row) => row.kind === kind).map((row) => row.skill_id),
      wanted,
    );
    if (changes.add.length > 0) {
      const { error } = await supabase
        .from("profile_skills")
        .insert(changes.add.map((skill_id) => ({ profile_id: userId, skill_id, kind })));
      if (error) return failed(`adding ${kind}`, error);
    }
    if (changes.remove.length > 0) {
      const { error } = await supabase
        .from("profile_skills")
        .delete()
        .eq("profile_id", userId)
        .eq("kind", kind)
        .in("skill_id", changes.remove);
      if (error) return failed(`removing ${kind}`, error);
    }
  }

  // 5. Photo. New files get a fresh random name, so nothing is ever overwritten.
  const oldAvatarPath = currentProfile.data.avatar_path;
  let avatarPath = oldAvatarPath;
  let uploadedPath: string | null = null;
  if (newAvatar) {
    uploadedPath = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[newAvatar.type]}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(uploadedPath, newAvatar, { contentType: newAvatar.type, upsert: false });
    if (error) {
      console.error("photo upload failed:", error.message);
      return {
        status: "error",
        message: "We couldn't upload your photo. Please try a different one.",
        fieldErrors: { avatar: "Upload failed." },
      };
    }
    avatarPath = uploadedPath;
  } else if (formData.get("remove_avatar") === "on") {
    avatarPath = null;
  }

  // 6. The profile itself, last.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: input.display_name,
      work_modes: input.work_modes,
      country: input.country,
      city: input.city === "" ? null : input.city,
      district: input.district === "" ? null : input.district,
      idea_statuses: input.idea_statuses,
      pitch: input.idea_statuses.includes("has_idea") ? input.pitch : null,
      weekly_hours: input.weekly_hours,
      partner_weekly_hours: input.partner_weekly_hours.length === 0 ? null : input.partner_weekly_hours,
      ambitions: input.ambitions,
      avatar_path: avatarPath,
      onboarded: true,
    })
    .eq("id", userId);

  if (profileError) {
    if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
    return failed("updating the profile", profileError);
  }

  // 7. Tidy up the previous photo if it was replaced or removed.
  if (oldAvatarPath && oldAvatarPath !== avatarPath) {
    const { error } = await supabase.storage.from("avatars").remove([oldAvatarPath]);
    if (error) console.error("could not delete old photo:", error.message);
  }

  redirect(currentProfile.data.onboarded ? "/profile?saved=1" : "/feed");
}

function failed(step: string, error: { code?: string; message: string }): ProfileFormState {
  console.error(`saveProfile failed while ${step}:`, error.code, error.message);
  return { status: "error", message: GENERIC_ERROR };
}

export type ChangePasswordState = {
  status: "idle" | "error" | "done";
  message?: string;
  fieldErrors?: Record<string, string>;
};

// Changes the logged-in user's password. The current password is checked first, so
// someone who finds an unlocked phone cannot quietly take over the account.
export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const email = typeof auth?.claims?.email === "string" ? auth.claims.email : null;
  if (!email) redirect("/login");

  // Check the current password by logging in with it.
  const check = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.current_password,
  });
  if (check.error) {
    if (check.error.status === 429) {
      return { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };
    }
    return { status: "error", fieldErrors: { current_password: "That isn't your current password." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) {
    console.error("updateUser(password) failed:", error.status, error.code);
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { new_password: "That password is too easy to guess. Try a longer one." } };
    }
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { new_password: "Choose a password different from the current one." } };
    }
    return { status: "error", message: "We couldn't change your password. Please try again." };
  }
  return { status: "done" };
}
