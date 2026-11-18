import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";

test("un lien commun permet de choisir son nom avant la connexion et de rejoindre le groupe", async ({ page, browser }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(demoEmail("camille"));
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
  await page.getByRole("link", { name: "Créer un groupe" }).click();
  const name = `Invitation partagée QA ${randomUUID().slice(0, 8)}`;
  const date = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 16);
  await page.getByLabel("Nom du groupe").fill(name);
  await page.getByLabel("Date et heure du tirage").fill(date(3));
  await page.getByLabel("Date et heure de l’échange").fill(date(9));
  await page.getByRole("button", { name: "Créer le groupe" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const editionUrl = page.url();
  await page.getByLabel("Noms des participants").fill("Léa QA\nNora QA");
  await page.getByRole("button", { name: "Créer l’invitation du groupe", exact: true }).click();
  const link = page.getByLabel("Lien d’invitation du groupe");
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  expect(url).toMatch(/\/invitation\/[a-f0-9]{64}$/);
  expect(decodeURIComponent(await page.getByRole("link", { name: "WhatsApp", exact: true }).getAttribute("href"))).toContain(url);

  const guestContext = await browser.newContext({ viewport: page.viewportSize() });
  const otherContext = await browser.newContext({ viewport: page.viewportSize() });
  const guest = await guestContext.newPage();
  const otherGuest = await otherContext.newPage();
  try {
    await guest.goto(url);
    await expect(guest.getByLabel("Quel est ton nom ?")).toBeVisible();
    await expect(guest.getByLabel("Adresse mail")).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page: guest }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    await guest.getByLabel("Quel est ton nom ?").selectOption({ label: "Léa QA" });
    await guest.getByRole("button", { name: "C’est moi, continuer", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
    const next = new URL(guest.url()).searchParams.get("next");
    expect(next).toContain("?participant=");
    await guest.getByRole("link", { name: "Créer un compte", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Créer mon compte", exact: true })).toBeVisible();
    expect(new URL(guest.url()).searchParams.get("next")).toBe(next);
    await guest.getByRole("link", { name: "Revenir à la connexion", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Se connecter", exact: true })).toBeVisible();
    await guest.getByLabel("Adresse mail").fill(demoEmail("lea"));
    await guest.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
    await guest.getByRole("button", { name: "Se connecter", exact: true }).click();
    await guest.getByRole("button", { name: "Rejoindre en tant que Léa QA", exact: true }).click();
    await expect(guest).toHaveURL(editionUrl);
    await expect(guest.getByRole("heading", { name, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /^Léa QA/ })).toBeChecked();
    await expect(page.getByRole("button", { name: "Retirer Léa QA", exact: true })).toHaveCount(0);
    await otherGuest.goto(url);
    await expect(otherGuest.getByRole("option", { name: "Léa QA · Déjà inscrit", exact: true })).toBeDisabled();
  } finally {
    await guestContext.close();
    await otherContext.close();
  }
});
