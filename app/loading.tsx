import { Brand } from "./brand";

export default function LoadingPage() {
  return <>
    <header className="top"><div className="shell bar"><Brand/></div></header>
    <main className="shell workspace stack">
      <p role="status" className="feedback">Chargement de la page…</p>
      <div className="card-grid" aria-hidden="true">
        <div className="panel loading-card"/><div className="panel loading-card"/>
      </div>
    </main>
  </>;
}
