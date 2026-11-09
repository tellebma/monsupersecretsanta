import { timingSafeEqual } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { drawAssignments } from "@/lib/draw";
import { appOrigin } from "@/lib/format";
import { workerClient } from "@/lib/supabase";

export const maxDuration = 60;

type Job = { id: string; version: number; members: string[]; blocked: [string, string][] };
type Mail = { id: string; attempts: number; kind: string; email: string; payload: Record<string, string> };

function textFor({ kind, payload }: Mail): [string, string] {
  const root = appOrigin();
  const group = payload.group ?? "votre Secret Santa";
  const link = `${root}/groupes/${payload.edition}`;
  switch (kind) {
    case "invite": return [`Invitation à ${group}`, `Tu es invité à participer à ${group}. Rejoins le groupe ici : ${root}/invitation/${payload.token}`];
    case "invite_code": return ["Ton code d’invitation", `Voici ton code de vérification : ${payload.code}. Il est valable 15 minutes.`];
    case "draw": return [`Le tirage de ${group} est disponible`, `Connecte-toi et clique sur « Tirer au sort » dans le groupe pour découvrir ton destinataire.\n\n${link}`];
    case "blocked": return [`Tirage à ajuster pour ${group}`, `Le tirage n’a pas pu être réalisé. Vérifie la date, la liste des participants et les contraintes, puis programme-le de nouveau.\n\n${link}`];
    case "empty": return ["Ta liste de cadeaux est encore vide", `Ajoute quelques idées pour aider la personne qui t’a tiré au sort.\n\n${root}/mes-cadeaux`];
    case "reservation": return ["Ton cadeau est toujours réservé", `Tu as réservé « ${payload.gift} » il y a cinq jours. Tu peux confirmer son achat ou libérer la réservation. Elle expire après 14 jours.\n\n${link}`];
    case "exchange": return [`L’échange de ${group} approche`, `Retrouve la date de l’échange et ta liste de cadeaux dans le groupe.\n\n${link}`];
    default: throw new Error("Type de mail inconnu.");
  }
}

async function send(job: Mail) {
  const [subject, text] = textFor(job);
  const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `secret-santa-${job.id}`,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [job.email], subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  return response.ok;
}

export async function POST(request: Request) {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const secret = process.env.SCHEDULE_SECRET;
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401 });
  }
  const db = workerClient();
  const { data: jobs, error: drawError } = await db.rpc("santa_due_draws");
  if (drawError) return Response.json({ error: "draw_queue" }, { status: 500 });
  let failures = 0;
  for (const job of jobs as Job[]) {
    const { error } = await db.rpc("santa_finish_draw", {
      p_edition: job.id, p_version: job.version, p_assignments: drawAssignments(job.members, job.blocked),
    });
    if (error) failures++;
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return Response.json({ error: "mail_configuration", failures }, { status: 503 });
  }
  const { data: mail, error: mailError } = await db.rpc("santa_due_mail");
  if (mailError) return Response.json({ error: "mail_queue" }, { status: 500 });
  const messages = mail as Mail[];
  for (let i = 0; i < messages.length; i += 2) {
    await Promise.all([wait(1050), ...messages.slice(i, i + 2).map(async (job) => {
      const { data: valid, error } = await db.rpc("santa_mail_valid", { p_id: job.id });
      let ok = false;
      if (!error) {
        try { ok = !valid || await send(job); } catch { /* The outbox will retry. */ }
      }
      const { error: updateError } = await db.rpc("santa_mail_result", { p_id: job.id, p_attempt: job.attempts, p_ok: ok });
      if (!ok || updateError) failures++;
    })]);
  }
  return Response.json({ failures }, { status: failures ? 500 : 200 });
}
