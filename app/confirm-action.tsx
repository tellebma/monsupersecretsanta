"use client";

import { useActionState, useRef, useState } from "react";
import type { Result } from "./actions";
import { Submit } from "./components";

export function ConfirmAction({ action, label, item, question }: {
  action: (previous: Result, data: FormData) => Promise<Result>;
  label: string; item: string; question: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [result, submit, pending] = useActionState(action, {});
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className="confirm-action">
    <button ref={trigger} type="button" className="text-button danger-text" aria-expanded={confirming}
      onClick={() => setConfirming(true)} hidden={confirming}>{label}<span className="sr-only"> · {item}</span></button>
    {confirming && <form action={submit} className="confirm-box stack tight" aria-label={question}>
      <p>{question}</p>
      {result.error && <p role="alert" className="feedback error">{result.error}</p>}
      <div className="inline">
        <Submit className="button danger small">Confirmer le retrait</Submit>
        <button type="button" className="button outline small" disabled={pending} onClick={() => {
          setConfirming(false);
          requestAnimationFrame(() => trigger.current?.focus());
        }}>Annuler</button>
      </div>
    </form>}
  </div>;
}
