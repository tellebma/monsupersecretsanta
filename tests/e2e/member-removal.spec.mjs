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

test("l’organisateur retire des participants avant le tirage et garde son accès", async ({ page, browser }) => {
  const group = randomUUID();
  const edition = randomUUID();
  const name = "Retrait QA " + edition.slice(0, 6);
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await db.connect();
    const people = (await db.query("select id,email from auth.users where email=any($1) order by email",
      [[demoEmail("camille"), demoEmail("lea")]])).rows;
    expect(people).toHaveLength(2);
    await db.query("insert into santa.groups(id,owner_id,name) values($1,$2,$3)", [group, people[0].id, name]);
    await db.query(`insert into santa.editions(id,group_id,year,draw_at,exchange_at,state)
      values($1,$2,extract(year from (now()+interval '20 days') at time zone 'Europe/Paris'),
        now()+interval '1 day',now()+interval '20 days','scheduled')`, [edition, group]);
    for (const [index, person] of people.entries()) {
      await db.query("insert into santa.members(edition_id,user_id,name,email) values($1,$2,$3,$4)",
        [edition, person.id, ["Camille", "Léa"][index], person.email]);
    }
  } finally {
    await db.end();
  }
  const participant = await browser.newPage();
  try {
    await signIn(participant, "lea");
    await participant.goto(`/groupes/${edition}`);
    await expect(participant.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(participant.getByRole("heading", { name: "Retirer un participant" })).toHaveCount(0);
    await signIn(page, "camille");
    await page.goto(`/groupes/${edition}`);
    await expect(page.getByText("Tirage programmé", { exact: true })).toBeVisible();
    await page.getByLabel("Participant à retirer").selectOption({ label: `Léa (${demoEmail("lea")})` });
    await page.getByRole("button", { name: "Retirer du groupe" }).click();
    await expect(page.getByText("Le tirage repassera en brouillon.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("checkbox", { name: /^Léa/ })).toBeChecked();
    await page.getByRole("button", { name: "Retirer du groupe" }).click();
    await page.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(page.getByText("Inscriptions ouvertes", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /^Léa/ })).toHaveCount(0);
    await participant.goto("/groupes");
    await expect(participant.getByRole("heading", { name, exact: true })).toHaveCount(0);

    await page.getByLabel("Participant à retirer").selectOption({ label: `Camille (${demoEmail("camille")})` });
    await page.getByRole("button", { name: "Retirer du groupe" }).click();
    await page.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(page.getByRole("checkbox", { name: /^Camille/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Organisation", exact: true })).toBeVisible();
  } finally {
    await participant.close();
  }
});
