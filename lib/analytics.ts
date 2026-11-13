// Only known page categories leave the browser: never tokens, IDs or queries.
export function analyticsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const publicPages = ["/", "/connexion", "/groupes", "/groupes/nouveau", "/mes-cadeaux", "/mes-cadeaux/chercher"];
    let safePath: string;
    if (publicPages.includes(path)) safePath = path;
    else if (/^\/invitation\/[^/]+$/.test(path)) safePath = "/invitation/[token]";
    else if (/^\/groupes\/[^/]+$/.test(path)) safePath = "/groupes/[edition]";
    else if (/^\/mes-cadeaux\/[^/]+$/.test(path)) safePath = "/mes-cadeaux/[gift]";
    else return null;
    return `${url.origin}${safePath}`;
  } catch {
    return null;
  }
}
