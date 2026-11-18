import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";

test("parcours cohérent au clavier, mot de passe visible et écrans accessibles", async ({ page }, testInfo) => {
  await page.goto("/connexion");
  const password = page.getByLabel("Mot de passe", { exact: true });
  await password.fill(localPassword);
  await page.getByRole("button", { name: "Afficher : mot de passe", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue(localPassword);
  await page.getByRole("button", { name: "Masquer : mot de passe", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.screenshot({ path: testInfo.outputPath("connexion.png"), fullPage: true });
  await page.getByLabel("Adresse mail").fill(demoEmail("camille"));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
  for (const [path, screenshot] of [["/groupes", "groupes"], ["/mes-cadeaux", "liste"], ["/mes-cadeaux/nouveau", "ajouter"], ["/mes-cadeaux/chercher", "catalogue"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${screenshot}.png`), fullPage: true });
  }
  await page.goto("/groupes");
  await page.getByRole("article").first().getByRole("link", { name: /Ouvrir le groupe/ }).click();
  await expect(page.getByRole("list", { name: "Étapes du groupe" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("organisation.png"), fullPage: true });
});
