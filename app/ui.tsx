import type { ReactNode } from "react";
import { GiftIcon } from "./brand";
import type { Edition } from "@/lib/types";

export function PageHeader({ title, description, eyebrow, action }: {
  title: string; description?: string; eyebrow?: string; action?: ReactNode;
}) {
  return <header className="page-header">
    <div className="page-intro">
      {eyebrow && <p className="eyebrow"><span/>{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="page-actions">{action}</div>}
  </header>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="panel empty"><div className="brand-mark"><GiftIcon/></div>
    <h2>{title}</h2><div className="empty-copy">{children}</div>
  </div>;
}

const editionStates = {
  draft: { label: "Inscriptions ouvertes", tone: "neutral" },
  scheduled: { label: "Tirage programmé", tone: "success" },
  blocked: { label: "Tirage à ajuster", tone: "warning" },
  drawn: { label: "Tirage effectué", tone: "success" },
};

export function EditionStatus({ state }: { state: Edition["state"] }) {
  const { label, tone } = editionStates[state];
  return <span className={`pill pill-${tone}`}><span className="status-dot" aria-hidden="true"/>{label}</span>;
}

export function GroupProgress({ state }: { state: Edition["state"] }) {
  const active = state === "drawn" ? 2 : state === "scheduled" ? 1 : 0;
  return <ol className="flow-steps" aria-label="Étapes du groupe">
    {["Inviter les participants", "Préparer le tirage", "Offrir un cadeau"].map((label, index) =>
      <li key={label} aria-current={index === active ? "step" : undefined} data-complete={index < active}>
        <span className="flow-number" aria-hidden="true">{index < active ? "✓" : index + 1}</span><span>{label}</span>
      </li>)}
  </ol>;
}
