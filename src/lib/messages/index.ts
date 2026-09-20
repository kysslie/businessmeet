import { fr } from "./fr";

// The shape every language file must have. To add English: write `en.ts` as
// `export const en: Messages = { ... }` and pick it below.
export type Messages = typeof fr;

// The language of the app. French only for the launch.
export const m: Messages = fr;
