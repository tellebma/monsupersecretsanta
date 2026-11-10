"use client";

import { useActionState, useState } from "react";
import type { Result } from "@/app/actions";
import { Submit } from "@/app/components";
import type { Edition } from "@/lib/types";

type Member = NonNullable<Edition["members"]>[number];

export default function MemberRemoval({ action, members, scheduled }: {
  action: (member: string, previous: Result, data: FormData) => Promise<Result>;
  members: Member[];
  scheduled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const member = members.find(({ id }) => id === selected);
  const [result, submit, pending] = useActionState<Result, FormData>(async (previous, data) => {
    if (!member) return { error: "Ce participant n’est plus dans le groupe." };
    const outcome = await action(member.id, previous, data);
    if (!outcome.error) {
      setSelected("");
      setConfirming(false);
    }
    return outcome;
  }, {});
  if (!members.length && !result.message) return null;

  return <section className="panel stack" aria-labelledby="member-removal-heading">
    <h3 id="member-removal-heading">Retirer un participant</h3>
    {result.message && !member && <p role="status" className="feedback">{result.message}</p>}
    {members.length > 0 && <>
      <label>Participant à retirer
        <select value={member?.id ?? ""} disabled={Boolean(member && confirming) || pending}
          onChange={(event) => { setSelected(event.target.value); setConfirming(false); }}>
          <option value="">Choisir un participant</option>
          {members.map(({ id, name, email }) => <option key={id} value={id}>{name} ({email})</option>)}
        </select>
      </label>
      {member && !confirming &&
        <button className="button outline" type="button" onClick={() => setConfirming(true)}>Retirer du groupe</button>}
      {member && confirming && <form action={submit} className="stack tight">
        <p>Retirer {member.name} de cette édition ?</p>
        {scheduled && member.selected && members.filter(({ selected }) => selected).length <= 2 &&
          <p className="hint">Il restera moins de deux participants retenus. Le tirage repassera en brouillon.</p>}
        {result.error && <p role="alert" className="feedback error">{result.error}</p>}
        <div className="inline">
          <Submit>Confirmer le retrait</Submit>
          <button className="button outline" type="button" disabled={pending} onClick={() => setConfirming(false)}>Annuler</button>
        </div>
      </form>}
    </>}
  </section>;
}
