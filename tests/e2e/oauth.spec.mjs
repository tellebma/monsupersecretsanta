import { expect, test } from "@playwright/test";

test("un fournisseur OAuth désactivé laisse la connexion par mail accessible", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Continuer avec Google" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Cette méthode de connexion est temporairement indisponible." })).toBeVisible();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByLabel("Adresse mail")).toBeVisible();
});
