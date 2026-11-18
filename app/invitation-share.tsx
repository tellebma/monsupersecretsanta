"use client";

import { useEffect, useState } from "react";

export function InvitationShare({ url, group }: { url: string; group: string }) {
  const [message, setMessage] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const text = `Rejoins notre Secret Santa « ${group} » ! Ouvre le lien, choisis ton nom et rejoins le groupe :`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié ! Tu peux le coller dans le message de ton choix.");
    } catch {
      setMessage("Sélectionne le lien ci-dessus pour le copier manuellement.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Secret Santa · ${group}`, text, url });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setMessage("Le partage n’a pas pu s’ouvrir. Tu peux copier le lien.");
    }
  }

  return <div className="stack tight">
    <label>Lien d’invitation du groupe<input readOnly value={url} onFocus={(event) => event.currentTarget.select()}/></label>
    <div className="inline">
      <button className="button outline small" type="button" onClick={copy}>Copier le lien</button>
      <a className="button outline small" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      {canShare && <button className="button outline small" type="button" onClick={share}>Partager…</button>}
    </div>
    {message && <p role="status" className="hint">{message}</p>}
  </div>;
}
