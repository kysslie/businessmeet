// Fixed choices for a project. The database enforces the same limits and values.
import { m } from "@/lib/messages";
import { WEEKLY_HOURS } from "@/lib/profile-options";

export const PROJECT_NAME_MAX_LENGTH = 80;
export const PROJECT_ROLE_MAX_LENGTH = 80;
export const PROJECT_LESSONS_MAX_LENGTH = 500;
export const PROJECT_LINK_LABEL_MAX_LENGTH = 60;
export const PROJECT_LINK_URL_MAX_LENGTH = 500;
export const PROJECT_MAX_LINKS = 5;

// Same four ranges as the profile's weekly-hours question, but a project has only one.
export const PROJECT_HOURS_PER_WEEK = WEEKLY_HOURS;

export const PROJECT_OUTCOMES = [
  { value: "idea_abandoned", label: m.projects.outcomes.idea_abandoned },
  { value: "launched_then_stopped", label: m.projects.outcomes.launched_then_stopped },
  { value: "ongoing", label: m.projects.outcomes.ongoing },
  { value: "sold", label: m.projects.outcomes.sold },
] as const;
