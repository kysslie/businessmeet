"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser, reportUser } from "@/app/safety/actions";
import { m } from "@/lib/messages";
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS } from "@/lib/validation/safety";

type Step = "closed" | "menu" | "report" | "block" | "reported" | "blocked";

// "Plus d'options" under a profile: report it, or block it. Used under swipe cards and on a
// conversation. `onBlocked` runs after a block (the deck moves to the next card);
// `afterBlockGoTo` sends the person to another page instead (a blocked conversation is gone).
export function SafetyMenu({
  targetId,
  name,
  onBlocked,
  afterBlockGoTo,
}: {
  targetId: string;
  name: string;
  onBlocked?: () => void;
  afterBlockGoTo?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function close() {
    setStep("closed");
    setError(null);
  }

  function block() {
    setError(null);
    startBusy(async () => {
      const result = await blockUser(targetId);
      if (!result.ok) return setError(result.message);
      setStep("blocked");
      onBlocked?.();
      if (afterBlockGoTo) router.push(afterBlockGoTo);
    });
  }

  function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startBusy(async () => {
      const result = await reportUser(targetId, reason, details);
      if (!result.ok) return setError(result.message);
      setStep("reported");
    });
  }

  if (step === "closed") {
    return (
      <button type="button" onClick={() => setStep("menu")} className="text-sm text-zinc-500 underline">
        {m.safety.menu}
      </button>
    );
  }

  const box = "flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";
  const errorText = error && (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
      {error}
    </p>
  );
  const secondary =
    "h-10 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700";
  const primary = "h-10 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60";

  if (step === "menu") {
    return (
      <div className={box}>
        <button type="button" onClick={() => setStep("report")} className="text-left text-sm">
          {m.safety.report}
        </button>
        <button type="button" onClick={() => setStep("block")} className="text-left text-sm">
          {m.safety.block}
        </button>
        <button type="button" onClick={close} className="text-left text-sm text-zinc-500">
          {m.safety.cancel}
        </button>
      </div>
    );
  }

  if (step === "block") {
    return (
      <div className={box} role="alertdialog">
        <p className="text-sm">{m.safety.blockAsk(name)}</p>
        <p className="text-sm text-zinc-500">{m.safety.blockPublicNote}</p>
        {errorText}
        <div className="flex gap-2">
          <button type="button" onClick={block} disabled={busy} className={primary}>
            {busy ? m.safety.blockBusy : m.safety.blockConfirm}
          </button>
          <button type="button" onClick={close} disabled={busy} className={secondary}>
            {m.safety.cancel}
          </button>
        </div>
      </div>
    );
  }

  if (step === "blocked") {
    return (
      <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" role="status">
        {m.safety.blocked}
      </p>
    );
  }

  if (step === "reported") {
    return (
      <div className={box} role="status">
        <p className="text-sm">{m.safety.reported}</p>
        <p className="text-sm text-zinc-500">{m.safety.reportedThenBlock}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep("block")} className={secondary}>
            {m.safety.block}
          </button>
          <button type="button" onClick={close} className={secondary}>
            {m.safety.cancel}
          </button>
        </div>
      </div>
    );
  }

  // step === "report"
  return (
    <form onSubmit={report} className={box}>
      <p className="text-sm font-medium">{m.safety.reportTitle(name)}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{m.safety.reasonLabel}</legend>
        {REPORT_REASONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        {m.safety.detailsLabel}
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={REPORT_DETAILS_MAX_LENGTH}
          rows={3}
          placeholder={m.safety.detailsPlaceholder}
          className="rounded-xl border border-zinc-300 bg-transparent p-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      {errorText}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || reason === ""} className={primary}>
          {busy ? m.safety.reportBusy : m.safety.reportSend}
        </button>
        <button type="button" onClick={close} disabled={busy} className={secondary}>
          {m.safety.cancel}
        </button>
      </div>
    </form>
  );
}
