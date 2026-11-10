const paris = "Europe/Paris";
const formDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: paris,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function dateInput(value: string | Date) {
  const parts = Object.fromEntries(formDate.formatToParts(new Date(value)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parisInstant(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Renseignez une date et une heure.");
  const base = new Date(`${local}:00Z`).getTime();
  if (!Number.isFinite(base)) throw new Error("Date invalide.");
  for (const offset of [2, 1]) {
    const candidate = new Date(base - offset * 3600_000);
    if (dateInput(candidate) === local) return candidate.toISOString();
  }
  throw new Error("Cette heure n’existe pas en France à cette date. Choisissez une autre heure.");
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: paris, dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

export function priceLabel(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function safeLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function safeProductImage(value: unknown) {
  const url = safeLink(value);
  if (!url || url.protocol !== "https:" || url.port) return null;
  const host = url.hostname.replace(/\.$/, "");
  const publicHostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
  if (!publicHostname.test(host) || /\.(?:localhost|local|internal|test|invalid|example|onion|arpa)$/i.test(host)) return null;
  return url;
}

export function nextPath(value: unknown) {
  return typeof value === "string" && /^\/invitation\/[a-f0-9]{64}$/.test(value) ? value : "/groupes";
}

export function appOrigin() {
  return new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;
}
