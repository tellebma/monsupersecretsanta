import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";

async function signIn(page, person) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(demoEmail(person));
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
}

test("renomme un groupe après le tirage pour toutes ses éditions et ses participants", async ({ page, browser }) => {
  const group = randomUUID();
  const edition = randomUUID();
  const nextEdition = randomUUID();
  const original = "Famille QA " + group.slice(0, 8);
  const renamed = "Noël entre amis " + group.slice(0, 8);
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await db.connect();
    const people = (await db.query("select id,email from auth.users where email=any($1) order by email", [[demoEmail("camille"), demoEmail("lea")]])).rows;
    expect(people).toHaveLength(2);
    await db.query("insert into santa.groups(id,owner_id,name) values($1,$2,$3)", [group, people[0].id, original]);
    await db.query(`insert into santa.editions(id,group_id,year,draw_at,exchange_at,state) values
      ($1,$3,2098,now()+interval '1 day',now()+interval '20 days','drawn'),
      ($2,$3,2099,now()+interval '2 days',now()+interval '30 days','draft')`, [edition, nextEdition, group]);
    await db.query("insert into santa.members(edition_id,user_id,name,email) values($1,$2,'Léa',$3)", [edition, people[1].id, people[1].email]);
  } finally { await db.end(); }
  await signIn(page, "camille");
  await page.goto(`/groupes/${edition}`);
  await page.getByText("Modifier le nom du groupe", { exact: true }).click();
  await expect(page.getByLabel("Nom du groupe", { exact: true })).toHaveValue(original);
  await page.getByLabel("Nom du groupe", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "Enregistrer le nom", exact: true }).click();
  await expect(page.getByRole("heading", { name: renamed, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Le nom du groupe a été modifié.");
  await page.goto(`/groupes/${nextEdition}`);
  await expect(page.getByRole("heading", { name: renamed, exact: true, level: 1 })).toBeVisible();
  await page.goto("/groupes");
  await expect(page.getByRole("heading", { name: renamed, exact: true })).toHaveCount(2);
  const participant = await browser.newPage();
  try {
    await signIn(participant, "lea");
    await participant.goto(`/groupes/${edition}`);
    await expect(participant.getByRole("heading", { name: renamed, exact: true, level: 1 })).toBeVisible();
    await expect(participant.getByText("Modifier le nom du groupe", { exact: true })).toHaveCount(0);
  } finally { await participant.close(); }
});
