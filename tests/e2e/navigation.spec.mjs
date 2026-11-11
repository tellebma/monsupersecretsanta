import { expect, test } from "@playwright/test";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";

test("repère la section active et accède au contenu au clavier", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(demoEmail("lea"));
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
  await page.goto("/groupes");
  const navigation = page.getByRole("navigation", { name: "Mon espace" });
  await expect(navigation.getByRole("link", { name: "Mes groupes", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  const firstGroup = page.getByRole("article").first();
  const groupName = await firstGroup.getByRole("heading").innerText();
  await expect(firstGroup.getByRole("link", { name: "Ouvrir le groupe" })).toHaveAccessibleName(new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await navigation.getByRole("link", { name: "Ma liste", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "Ma liste", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "Mes groupes", exact: true })).not.toHaveAttribute("aria-current");
  const firstGift = page.getByRole("article").first();
  const giftName = await firstGift.getByRole("heading").innerText();
  await expect(firstGift.getByRole("link", { name: "Modifier" })).toHaveAccessibleName("Modifier · " + giftName);
  await expect(firstGift.getByRole("button", { name: "Retirer de ma liste" })).toHaveAccessibleName("Retirer de ma liste · " + giftName);
  await page.getByRole("link", { name: "Chercher un cadeau", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "Ma liste", exact: true })).toHaveAttribute("aria-current", "location");
});

test("retrouve les liens utiles depuis une page introuvable", async ({ page }) => {
  const response = await page.goto("/page-inexistante-secret-santa");
  expect(response.status()).toBe(404);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Tu t’es égaré ?", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Retour à l’accueil" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sans les doublons");
});
