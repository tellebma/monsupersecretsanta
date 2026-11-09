"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { emailAccount, fetchProduct, login, social, type Result } from "./actions";
import { safeLink } from "@/lib/format";
import type { Edition, Gift, Link } from "@/lib/types";

type Action = (state: Result, data: FormData) => Promise<Result>;

function Feedback({ result }: { result: Result }) {
  return result.error ? <p role="alert" className="feedback error">{result.error}</p> :
    result.message ? <p role="status" className="feedback">{result.message}</p> : null;
}

export function Submit({ children, className = "button", intent, skipValidation }: {
  children: ReactNode; className?: string; intent?: string; skipValidation?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} name={intent ? "intent" : undefined} value={intent} formNoValidate={skipValidation}>
    {pending ? "Un instant…" : children}
  </button>;
}

export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [result, submit] = useActionState(action, {});
  return <form action={submit} className={className}>
    {children}
    <Feedback result={result}/>
  </form>;
}

export function AuthForm({ mode, next }: { mode: "login" | "signup" | "reset"; next: string }) {
  const action = mode === "login" ? login : emailAccount.bind(null, mode);
  const [result, submit] = useActionState(action, {});
  return <form action={submit} className="stack">
    <input type="hidden" name="next" value={next}/>
    {!result.stage && <label>Adresse mail<input type="email" name="email" required autoComplete="email" placeholder="toi@exemple.fr"/></label>}
    {mode === "login" && <label>Mot de passe<input type="password" name="password" required autoComplete="current-password"/></label>}
    {result.stage === "verify" && <label>Code reçu par mail<input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={12}/></label>}
    {result.stage === "password" && <>
      <label>Nouveau mot de passe<input type="password" name="password" minLength={8} required autoComplete="new-password"/></label>
      <label>Confirmer le mot de passe<input type="password" name="confirmation" minLength={8} required autoComplete="new-password"/></label>
    </>}
    <Feedback result={result}/>
    <Submit>{mode === "login" ? "Se connecter" : result.stage === "verify" ? "Vérifier le code" : result.stage === "password" ? "Enregistrer mon mot de passe" : "Recevoir un code"}</Submit>
    {result.stage === "verify" && <Submit className="button outline" intent="resend" skipValidation>Renvoyer un code</Submit>}
  </form>;
}

export function SocialForm({ provider, next }: { provider: "google" | "apple"; next: string }) {
  return <ActionForm action={social.bind(null, provider)}>
    <input type="hidden" name="next" value={next}/>
    <Submit className="button outline wide">Continuer avec {provider === "google" ? "Google" : "Apple"}</Submit>
  </ActionForm>;
}

export function InviteForm({ action, initialName }: { action: Action; initialName: string }) {
  const [result, submit] = useActionState(action, {});
  const [name, setName] = useState(initialName);
  return <form action={submit} className="stack">
    <label>Nom d’affichage<input name="name" maxLength={80} required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)}/></label>
    {result.stage === "invite_code" && <label>Code envoyé à l’adresse invitée<input name="code" autoComplete="one-time-code" required maxLength={8}/></label>}
    <Feedback result={result}/>
    <Submit>{result.stage === "invite_code" ? "Vérifier et rejoindre" : "Rejoindre le groupe"}</Submit>
    {result.stage === "invite_code" && <Submit className="button outline" intent="resend" skipValidation>Renvoyer un code</Submit>}
  </form>;
}

export function ExceptionFields({ members = [], initial = [] }: { members?: Edition["members"]; initial?: Edition["exceptions"] }) {
  const [pairs, setPairs] = useState(initial);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const names = new Map(members.map((member) => [member.id, member.name]));
  if (members.length < 2) return null;
  function add() {
    if (!first || !second || first === second) return;
    const sorted = [first, second].sort() as [string, string];
    if (!pairs.some((pair) => pair[0] === sorted[0] && pair[1] === sorted[1])) setPairs([...pairs, sorted]);
    setFirst("");
    setSecond("");
  }
  return <fieldset><legend>Exceptions au tirage</legend>
    <p className="hint">Les deux personnes d’une exception sont exclues l’une pour l’autre.</p>
    {pairs.map(([a, b]) => <div key={`${a}:${b}`} className="inline spread list-row">
      <input type="hidden" name="exception" value={`${a}:${b}`}/>
      <span>{names.get(a)} et {names.get(b)}</span>
      <button className="text-button" type="button" onClick={() => setPairs(pairs.filter(([p, q]) => p !== a || q !== b))}>Retirer</button>
    </div>)}
    <div className="split">
      <label>Première personne<select value={first} onChange={(event) => setFirst(event.target.value)}>
        <option value="">Choisir</option>{members.map(({ id, name }) => <option key={id} value={id} disabled={id === second}>{name}</option>)}
      </select></label>
      <label>Deuxième personne<select value={second} onChange={(event) => setSecond(event.target.value)}>
        <option value="">Choisir</option>{members.map(({ id, name }) => <option key={id} value={id} disabled={id === first}>{name}</option>)}
      </select></label>
    </div>
    <button type="button" className="button outline small" disabled={!first || !second} onClick={add}>Ajouter l’exception</button>
  </fieldset>;
}

export function GiftForm({ action, gift }: { action: Action; gift?: Gift }) {
  const [result, submit] = useActionState(action, {});
  const [name, setName] = useState(gift?.name ?? "");
  const [description, setDescription] = useState(gift?.description ?? "");
  const [links, setLinks] = useState<Link[]>(gift?.links ?? []);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  async function append() {
    const parsed = safeLink(url.trim());
    if (!parsed) { setNotice("Saisis un lien commençant par https:// ou http://."); return; }
    if (links.some((link) => link.url === parsed.href)) { setNotice("Ce lien est déjà dans la liste."); return; }
    setLoading(true);
    setNotice("");
    try {
      const imported = await fetchProduct(parsed.href);
      setLinks((current) => [...current, imported ?? { url: parsed.href }]);
      if (imported) {
        setName((current) => current || imported.name || "");
        setDescription((current) => current || imported.description || "");
      }
      setNotice(imported ? "Informations produit importées." : "Lien ajouté. Tu peux compléter la fiche à la main.");
      setUrl("");
    } catch {
      setNotice("Impossible d’ajouter le lien pour le moment. Réessaie.");
    } finally {
      setLoading(false);
    }
  }
  return <form action={submit} className="stack">
    <label>Nom du cadeau<input name="name" maxLength={200} required value={name} onChange={(event) => setName(event.target.value)}/></label>
    <label>Description<textarea name="description" rows={4} maxLength={3000} required value={description} onChange={(event) => setDescription(event.target.value)}/></label>
    <fieldset><legend>Liens marchands</legend><p className="hint">Colle un lien produit. Les informations sont récupérées quand la boutique les rend accessibles.</p>
      {links.map((link) => <div className="inline spread list-row" key={link.url}>
        <span className="break">{link.name || safeLink(link.url)?.hostname || link.url}</span>
        <button className="text-button" type="button" onClick={() => setLinks(links.filter((item) => item.url !== link.url))}>Retirer</button>
      </div>)}
      {links.length < 20 && <div className="stack tight">
        <label>Lien vers un produit<input type="url" value={url} disabled={loading} placeholder="https://…" onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!loading) void append(); } }}/></label>
        <button type="button" className="button outline" onClick={append} disabled={loading}>{loading ? "Import en cours…" : "Ajouter le lien"}</button>
      </div>}
      {notice && <p role="status" className="hint">{notice}</p>}
    </fieldset>
    <input type="hidden" name="links" value={JSON.stringify(links)}/>
    <Feedback result={result}/>
    {loading || url.trim() ? <button type="submit" className="button" disabled>Enregistrer le cadeau</button> : <Submit>Enregistrer le cadeau</Submit>}
  </form>;
}
