import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";
import { captureMail } from "./mail.mjs";

async function signIn(page, person) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(demoEmail(person));
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
  await expect(page.getByRole("heading", { name: "Mes groupes" })).toBeVisible();
}

async function openGroup(page, name) {
  const group = page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
  await group.getByRole("link", { name: "Ouvrir le groupe" }).click();
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
}

function gift(page, title) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function assertAccessible(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) }))).toEqual([]);
}

test("accueil public, responsive et espace protégé", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sans les doublons");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Se connecter" })).toBeVisible();
  await page.goto("/groupes");
  await expect(page).toHaveURL(/\/connexion$/);
  expect((await request.post("/api/schedule")).status()).toBe(401);
  expect((await request.post("/api/schedule", { headers: { Authorization: "Bearer invalide" } })).status()).toBe(401);
});

test("accessibilité WCAG de l’accueil", async ({ page }) => {
  await page.goto("/");
  await assertAccessible(page);
});

test("accessibilité WCAG de la connexion", async ({ page }) => {
  await page.goto("/connexion");
  await assertAccessible(page);
});

test("retrouve son espace après avoir fermé et rouvert le navigateur", async ({ browser, baseURL }) => {
  const temporaryDirectory = resolve(tmpdir());
  const profile = await mkdtemp(join(temporaryDirectory, "santa-session-"));
  let context;
  try {
    context = await browser.browserType().launchPersistentContext(profile, { baseURL });
    await signIn(context.pages()[0] ?? await context.newPage(), "lea");
    const sessionCookies = (await context.cookies()).filter(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
    expect(sessionCookies.length).toBeGreaterThan(0);
    expect(sessionCookies.every(({ expires }) => expires > Date.now() / 1000)).toBe(true);
    await context.close();
    context = await browser.browserType().launchPersistentContext(profile, { baseURL });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Mon espace", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Mon espace", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mes groupes" })).toBeVisible();
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page.getByRole("link", { name: "Se connecter", exact: true })).toBeVisible();
    await page.goto("/groupes");
    await expect(page).toHaveURL(/\/connexion$/);
  } finally {
    await context?.close();
    if (dirname(profile) === temporaryDirectory) await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("crée un compte avec le code du mail, définit le mot de passe et se reconnecte", async ({ page, request }) => {
  const email = demoEmail(`acceptation-${randomUUID().slice(0, 12)}`);
  await page.goto("/connexion?mode=signup");
  await page.getByLabel("Adresse mail").fill(email);
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await expect(page.getByLabel("Code reçu par mail")).toBeVisible();
  const mailpit = process.env.TEST_MAILPIT_URL;
  let mailId;
  await expect.poll(async () => {
    const response = await request.get(`${mailpit}/api/v1/search`, { params: { query: `to:${email}` } });
    mailId = (await response.json()).messages?.[0]?.ID;
    return Boolean(mailId);
  }).toBe(true);
  const response = await request.get(`${mailpit}/api/v1/message/${mailId}`);
  const message = await response.json();
  const code = `${message.Text} ${message.HTML}`.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel("Code reçu par mail").fill(code);
  await page.getByRole("button", { name: "Vérifier le code" }).click();
  await expect(page.getByLabel("Nouveau mot de passe")).toBeVisible();
  await page.getByLabel("Nouveau mot de passe").fill(localPassword);
  await page.getByLabel("Confirmer le mot de passe").fill(localPassword);
  await page.getByRole("button", { name: "Enregistrer mon mot de passe" }).click();
  await expect(page).toHaveURL(/\/groupes$/);
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ton premier Secret Santa" })).toBeVisible();
});

test("voit uniquement son tirage et les statuts partagés entre groupes", async ({ page, browser }) => {
  await signIn(page, "camille");
  await openGroup(page, "Noël en famille");
  const reveal = page.getByRole("button", { name: "Tirer au sort" });
  if (await reveal.isVisible()) {
    await expect(page.getByText("Tu offres un cadeau à Léa")).toHaveCount(0);
    await reveal.click();
  }
  await expect(page.getByRole("heading", { name: "Tu offres un cadeau à Léa" })).toBeVisible();
  await expect(gift(page, "Casque audio")).toContainText("Indisponible");
  await expect(gift(page, "Tasse en grès")).toContainText("Déjà acheté");
  await expect(gift(page, "Livre illustré").getByRole("link", { name: /Voir le produit/ })).toHaveCount(2);

  const other = await browser.newPage();
  try {
    await signIn(other, "nora");
    await openGroup(other, "Noël entre amis");
    await gift(page, "Livre illustré").getByRole("button", { name: "Réserver ce cadeau" }).click();
    await expect(gift(page, "Livre illustré")).toContainText("Réservé par toi");
    await other.reload();
    await expect(gift(other, "Livre illustré")).toContainText("Indisponible");
    await expect(gift(other, "Livre illustré").getByRole("button")).toHaveCount(0);
  } finally {
    const release = gift(page, "Livre illustré").getByRole("button", { name: "Libérer la réservation" });
    if (await release.isVisible()) {
      await release.click();
      await expect(gift(page, "Livre illustré").getByRole("button", { name: "Réserver ce cadeau" })).toBeVisible();
    }
    await other.close();
  }
});

test("ajoute deux liens manuellement, modifie puis retire une idée", async ({ page }) => {
  await signIn(page, "lea");
  await page.getByRole("link", { name: "Ma liste", exact: true }).click();
  await expect(gift(page, "Tasse en grès")).not.toContainText("Déjà acheté");
  await page.getByRole("link", { name: "Ajouter un cadeau" }).click();
  const title = `Idée de test ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nom du cadeau").fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Une idée fictive pour les tests.");
  for (const url of ["https://example.com/premier", "https://example.org/second"]) {
    await page.getByLabel("Lien vers un produit").fill(url);
    await page.getByRole("button", { name: "Ajouter le lien" }).click();
    await expect(page.getByRole("status")).toContainText("Lien ajouté");
  }
  await page.getByRole("button", { name: "Enregistrer le cadeau" }).click();
  await expect(gift(page, title).getByRole("link", { name: /Voir le produit/ })).toHaveCount(2);
  await gift(page, title).getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("textbox", { name: "Description", exact: true }).fill("Description modifiée.");
  await page.getByRole("button", { name: "Enregistrer le cadeau" }).click();
  await expect(gift(page, title)).toContainText("Description modifiée.");
  await gift(page, title).getByRole("button", { name: "Retirer de ma liste" }).click();
  await expect(gift(page, title)).toHaveCount(0);
});

test("crée un groupe, refuse un tirage incomplet et accepte une invitation avec une adresse différente", async ({ page, browser, request }) => {
  await signIn(page, "camille");
  await page.getByRole("link", { name: "Créer un groupe" }).click();
  const name = `Groupe QA ${randomUUID().slice(0, 8)}`;
  const localDate = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 16);
  await page.getByLabel("Nom du groupe").fill(name);
  await page.getByLabel("Date et heure du tirage").fill(localDate(3));
  await page.getByLabel("Date et heure de l’échange").fill(localDate(9));
  await page.getByLabel("Budget total indicatif (€)").fill("35");
  await page.getByRole("button", { name: "Créer l’édition" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const email = demoEmail("invitation-qa");
  await page.getByLabel("Adresses mail").fill(email);
  await page.getByRole("button", { name: "Envoyer les invitations" }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Valider et programmer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "au moins deux participants" })).toBeVisible();

  const mail = await captureMail();
  const invitee = await browser.newPage();
  try {
    await mail.deliver(request);
    const invitation = mail.messages.find(({ subject }) => subject.includes(name));
    const link = invitation?.text.match(/\/invitation\/[a-f0-9]{64}/)?.[0];
    expect(link).toBeTruthy();
    await invitee.goto(link);
    await expect(invitee).toHaveURL(/\/connexion\?next=/);
    await invitee.getByLabel("Adresse mail").fill(demoEmail("hugo"));
    await invitee.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
    await invitee.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(invitee.getByRole("heading", { name: "Rejoindre un Secret Santa" })).toBeVisible();
    await invitee.getByLabel("Nom d’affichage").fill("Hugo QA");
    await invitee.getByRole("button", { name: "Rejoindre le groupe" }).click();
    await expect(invitee.getByLabel("Code envoyé à l’adresse invitée")).toBeVisible();
    await mail.deliver(request);
    const verification = mail.messages.find(({ subject, to }) => subject === "Ton code d’invitation" && to.includes(email));
    const code = verification?.text.match(/\b[A-F0-9]{8}\b/)?.[0];
    expect(code).toBeTruthy();
    await invitee.getByLabel("Code envoyé à l’adresse invitée").fill(code);
    await invitee.getByRole("button", { name: "Vérifier et rejoindre" }).click();
    await expect(invitee.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: `Hugo QA ${email}` })).toBeChecked();
    await page.getByLabel("Nom d’affichage").fill("Camille QA");
    await page.getByRole("button", { name: "M’ajouter aux participants" }).click();
    await expect(page.getByRole("checkbox", { name: /^Camille QA/ })).toBeChecked();
    await page.getByRole("button", { name: "Valider et programmer" }).click();
    await expect(page.getByText("Tirage programmé", { exact: true })).toBeVisible();
    await expect(page.getByText("Les inscriptions sont closes.", { exact: false })).toBeVisible();
  } finally {
    await invitee.close();
    await mail.close();
  }
});
