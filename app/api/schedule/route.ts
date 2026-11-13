import { timingSafeEqual } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { drawAssignments } from "@/lib/draw";
import { appOrigin } from "@/lib/format";
import { renderMail } from "@/lib/mail";
import { workerClient } from "@/lib/supabase";

export const maxDuration = 60;

type Job = { id: string; version: number; members: string[]; blocked: [string, string][] };
type Mail = { id: string; attempts: number; kind: string; email: string; payload: Record<string, string> };

async function send(job: Mail) {
  const content = renderMail(job, appOrigin());
  const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `secret-santa-${job.id}`,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [job.email], ...content }),
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
