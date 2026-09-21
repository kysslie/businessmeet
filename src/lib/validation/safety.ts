import { z } from "zod";
import { m } from "@/lib/messages";

// The reasons a person can give when reporting. The stored value is the key (short, stable);
// the words people see come from the messages file.
export const REPORT_REASONS = [
  { value: "fake_profile", label: m.safety.reasons.fake_profile },
  { value: "harassment", label: m.safety.reasons.harassment },
  { value: "inappropriate", label: m.safety.reasons.inappropriate },
  { value: "spam", label: m.safety.reasons.spam },
  { value: "underage", label: m.safety.reasons.underage },
  { value: "other", label: m.safety.reasons.other },
] as const;

export const REPORT_DETAILS_MAX_LENGTH = 1000;

const reasonValues = REPORT_REASONS.map((reason) => reason.value) as [
  (typeof REPORT_REASONS)[number]["value"],
  ...(typeof REPORT_REASONS)[number]["value"][],
];

// guid = any correctly shaped id; the database checks the person exists and the rules apply.
export const targetSchema = z.guid();

export const reportSchema = z.object({
  targetId: z.guid(),
  reason: z.enum(reasonValues, { error: m.safety.errors.reasonRequired }),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX_LENGTH, m.safety.errors.detailsTooLong(REPORT_DETAILS_MAX_LENGTH)),
});
