import type { Edition } from "@/lib/types";
import { dateInput } from "@/lib/format";

export default function EditionFields({ edition }: { edition?: Edition }) {
  return <>
    <div className="split">
      <label>Date et heure du tirage<input type="datetime-local" name="draw" required defaultValue={edition ? dateInput(edition.draw_at) : undefined}/></label>
      <label>Date et heure de l’échange<input type="datetime-local" name="exchange" required defaultValue={edition ? dateInput(edition.exchange_at) : undefined}/></label>
    </div>
    <p className="hint">Heures de Paris. Les listes de cadeaux restent modifiables après le tirage.</p>
    <label>Budget total indicatif (€)<input type="number" name="budget" step="0.01" min="0.01" max="99999999.99" defaultValue={edition?.budget ?? undefined} placeholder="Facultatif"/></label>
  </>;
}
