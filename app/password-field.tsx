"use client";

import { useId, useState } from "react";

export function PasswordField({ label, name, autoComplete, minLength }: {
  label: string; name: string; autoComplete: "current-password" | "new-password"; minLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="password-control">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required/>
      <button type="button" aria-label={`${visible ? "Masquer" : "Afficher"} : ${label.toLowerCase()}`} aria-pressed={visible}
        onClick={() => setVisible(!visible)}>{visible ? "Masquer" : "Afficher"}</button>
    </div>
  </div>;
}
