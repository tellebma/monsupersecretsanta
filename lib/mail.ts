export type MailContent = { kind: string; payload: Record<string, string> };

type Template = {
  subject: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; url: string };
  code?: string;
  note: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

function templateFor({ kind, payload }: MailContent, root: string): Template {
  const group = payload.group ?? "votre Secret Santa";
  const link = `${root}/groupes/${encodeURIComponent(payload.edition ?? "")}`;
  switch (kind) {
    case "invite": return {
      subject: `Invitation à ${group}`, eyebrow: "UNE SURPRISE SE PRÉPARE", title: "Tu es de la partie !",
      description: `Tu es invité à participer à ${group}. Rejoins le groupe pour partager tes envies et préparer de belles surprises.`,
      action: { label: "Rejoindre le groupe", url: `${root}/invitation/${encodeURIComponent(payload.token ?? "")}` },
      note: "Cette invitation est personnelle. Garde ce lien pour toi.",
    };
    case "invite_code": return {
      subject: "Ton code d’invitation", eyebrow: "À TOI DE JOUER", title: "Confirme ton invitation",
      description: "Saisis ce code sur la page d’invitation pour rejoindre le groupe avec cette adresse mail.",
      code: payload.code, note: "Ce code est valable 15 minutes. Ne le partage avec personne. Si tu n’as pas demandé ce code, tu peux ignorer ce mail.",
    };
    case "draw": return {
      subject: `Le tirage de ${group} est disponible`, eyebrow: "LE SECRET T’ATTEND", title: "Le tirage est prêt !",
      description: `Le tirage de ${group} est disponible. Connecte-toi et clique sur « Tirer au sort » dans le groupe pour découvrir ton destinataire.`,
      action: { label: "Découvrir mon tirage", url: link }, note: "Chut… garde le nom de ton destinataire secret jusqu’à l’échange.",
    };
    case "blocked": return {
      subject: `Tirage à ajuster pour ${group}`, eyebrow: "UN PETIT AJUSTEMENT", title: "Le tirage a besoin de toi",
      description: `Le tirage de ${group} n’a pas pu être réalisé. Vérifie la date, la liste des participants et les contraintes, puis programme-le de nouveau.`,
      action: { label: "Ajuster le tirage", url: link }, note: "Les réglages du tirage sont accessibles à l’organisateur du groupe.",
    };
    case "empty": return {
      subject: "Ta liste de cadeaux est encore vide", eyebrow: "UN PEU D’INSPIRATION", title: "Et toi, qu’est-ce qui te ferait plaisir ?",
      description: "Ta liste de cadeaux est encore vide. Ajoute quelques idées pour aider la personne qui t’a tiré au sort à trouver une surprise qui te ressemble.",
      action: { label: "Ajouter mes envies", url: `${root}/mes-cadeaux` }, note: "Quelques idées suffisent pour mettre ton Secret Santa sur la bonne piste.",
    };
    case "reservation": return {
      subject: "Ton cadeau est toujours réservé", eyebrow: "UNE SURPRISE EN COURS", title: "Où en est ton cadeau ?",
      description: `Tu as réservé « ${payload.gift} » il y a cinq jours. Tu peux confirmer son achat ou libérer la réservation pour laisser la place à une autre idée.`,
      action: { label: "Gérer ma réservation", url: link }, note: "Une réservation expire après 14 jours si l’achat n’a pas été confirmé.",
    };
    case "exchange": return {
      subject: `L’échange de ${group} approche`, eyebrow: "BIENTÔT LE GRAND JOUR", title: "Les cadeaux entrent en scène",
      description: `L’échange de ${group} approche ! Retrouve la date de l’échange et ta liste de cadeaux dans le groupe pour préparer les derniers détails.`,
      action: { label: "Retrouver mon groupe", url: link }, note: "Un cadeau, un peu de mystère et le plaisir de se retrouver.",
    };
    default: throw new Error("Type de mail inconnu.");
  }
}

// Inline styles and presentation tables keep the email readable without external CSS or images.
function renderHtml(template: Template) {
  const e = escapeHtml;
  const action = template.action;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${e(template.subject)}</title>
  <style>@media only screen and (max-width: 600px) { .email-shell { width: 100% !important; } .email-content { padding: 30px 24px !important; } .email-title { font-size: 32px !important; } .email-button { display: block !important; text-align: center !important; } }</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#fbf7ee;color:#203c32;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:#fbf7ee;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${e(template.description)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fbf7ee">
    <tr><td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="email-shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;">
        <tr><td style="padding:0 12px 24px;text-align:center;color:#203c32;font-size:14px;line-height:22px;">Mon Super<br><strong style="font-size:20px;">Secret Santa</strong></td></tr>
        <tr><td style="background-color:#fffdf7;border:1px solid #dfd9c9;border-top:5px solid #1c513e;border-radius:16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td class="email-content" style="padding:40px 40px 36px;">
              <p style="margin:0 0 18px;color:#a13c3f;font-size:11px;font-weight:bold;letter-spacing:2px;line-height:18px;">${e(template.eyebrow)}</p>
              <h1 class="email-title" style="margin:0 0 22px;color:#203c32;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:normal;line-height:1.15;overflow-wrap:anywhere;">${e(template.title)}</h1>
              <p style="margin:0 0 28px;color:#53665d;font-size:16px;line-height:27px;overflow-wrap:anywhere;">${e(template.description)}</p>
              ${template.code !== undefined ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:22px 12px;background-color:#e8efe3;border:1px solid #ceddce;border-radius:10px;"><p style="margin:0 0 8px;color:#53665d;font-size:12px;line-height:18px;">TON CODE DE VÉRIFICATION</p><p style="margin:0;color:#1c513e;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:5px;line-height:42px;overflow-wrap:anywhere;">${e(template.code)}</p></td></tr></table>` : ""}
              ${action ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;"><tr><td align="left"><a class="email-button" href="${e(action.url)}" style="display:inline-block;background-color:#1c513e;border:1px solid #1c513e;border-radius:9px;padding:15px 24px;color:#fffdf7;font-size:16px;font-weight:bold;line-height:22px;text-decoration:none;mso-padding-alt:0;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt;" hidden>&emsp;</i><span style="mso-text-raise:11pt;"><![endif]-->${e(action.label)}<!--[if mso]></span><i style="mso-font-width:150%;" hidden>&emsp;&#8203;</i><![endif]--></a></td></tr></table>` : ""}
              <p style="margin:26px 0 0;padding-top:22px;border-top:1px solid #dfd9c9;color:#53665d;font-size:13px;line-height:21px;">${e(template.note)}</p>
            </td></tr>
          </table>
        </td></tr>
        ${action ? `<tr><td style="padding:22px 16px 0;color:#53665d;font-size:12px;line-height:20px;">Si le bouton ne fonctionne pas, ouvre ce lien :<br><a href="${e(action.url)}" style="color:#1c513e;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${e(action.url)}</a></td></tr>` : ""}
        <tr><td style="padding:24px 16px 0;text-align:center;color:#53665d;font-size:12px;line-height:20px;">Mon Super Secret Santa<br>Les petites attentions font les grandes surprises.</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderMail(job: MailContent, origin: string) {
  const root = new URL(origin);
  if (!["http:", "https:"].includes(root.protocol)) throw new Error("Origine des mails invalide.");
  const template = templateFor(job, root.origin);
  return {
    subject: template.subject,
    text: [template.title, template.description, template.code !== undefined ? `Code : ${template.code}` : null,
      template.action ? `${template.action.label} : ${template.action.url}` : null, template.note, "Mon Super Secret Santa"].filter(Boolean).join("\n\n"),
    html: renderHtml(template),
  };
}
