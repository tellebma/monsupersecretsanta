import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { demoEmail, localPassword } from "../../scripts/preprod-data.mjs";

async function signIn(page) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse mail").fill(demoEmail("lea"));
  await page.getByLabel("Mot de passe", { exact: true }).fill(localPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/groupes$/);
}

async function openGiftSearch(page) {
  await signIn(page);
  await page.getByRole("link", { name: "Ma liste", exact: true }).click();
  await page.getByRole("link", { name: "Chercher un cadeau", exact: true }).click();
  await expect(page).toHaveURL(/\/mes-cadeaux\/chercher$/);
  await expect(page.getByRole("heading", { name: "Chercher un cadeau", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Idées cadeaux à découvrir" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nom du cadeau" })).toHaveCount(0);
  const suggestions = page.getByRole("region", { name: "Catalogue de cadeaux" }).getByRole("listitem");
  await expect(suggestions).toHaveCount(6);
  await expect(suggestions.first()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("sélectionne un produit trouvé et enregistre sa fiche préremplie", async ({ page }) => {
  const product = {
    url: "https://www.fnac.com/carnet-qa",
    image: "https://example.com/image-qa.svg",
    name: "Carnet de voyage QA " + randomUUID().slice(0, 8),
    description: "Un carnet illustré au format A5.",
    price: 15,
    currency: "EUR",
  };
  const second = {
    url: "https://example.org/autre-carnet-" + randomUUID().slice(0, 8),
    name: "Autre lien pour le carnet",
    description: "Autre description.",
  };
  await page.route(product.image, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="green"/></svg>',
  }));
  await page.route("**/api/gift-search?*", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "sans résultat") return route.fulfill({ json: { status: "ok", products: [] } });
    expect(query).toBe("carnet");
    return route.fulfill({ json: { status: "ok", products: [product, second] } });
  });
  await openGiftSearch(page);
  await page.getByRole("searchbox", { name: "Nom du produit" }).fill("carnet");
  await page.getByRole("searchbox", { name: "Nom du produit" }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "2 produits trouvés" })).toBeVisible();
  const resultImage = page.getByRole("region", { name: "Catalogue de cadeaux" }).locator("img").first();
  await expect(resultImage).toHaveCSS("opacity", "1");
  await expect(resultImage).toHaveJSProperty("complete", true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Choisir " + product.name }).click();
  await expect(page.getByRole("link", { name: "Voir la fiche cadeau" })).toHaveAttribute("href", "#gift-editor");
  await expect(page.getByRole("textbox", { name: "Nom du cadeau" })).toHaveValue(product.name);
  await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue(product.description);
  await expect(page.getByRole("group", { name: "Liens marchands" }).locator("img")).toHaveAttribute("src", product.image);
  await page.getByRole("textbox", { name: "Description" }).fill("Description personnalisée.");
  await page.getByRole("button", { name: "Choisir " + second.name }).click();
  await expect(page.getByRole("status").filter({ hasText: "Produit partiellement importé." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouté " + second.name })).toBeDisabled();
  await page.getByRole("searchbox", { name: "Nom du produit" }).fill("sans résultat");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Aucun produit trouvé." })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "2 liens marchands" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Importer un lien" })).toHaveAttribute("href", "#gift-product-link");
  await expect(page.getByRole("textbox", { name: "Nom du cadeau" })).toHaveValue(product.name);
  await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue("Description personnalisée.");
  await page.getByRole("button", { name: "Enregistrer le cadeau" }).click();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: product.name }) });
  await expect(card.locator("img").first()).toHaveCSS("opacity", "1");
  await expect(card.getByRole("link", { name: /Voir le produit sur fnac.com/ })).toHaveAttribute("href", product.url);
  await expect(card.getByRole("link", { name: /Voir le produit sur example.org/ })).toHaveAttribute("href", second.url);
});

test("propose un lien après une recherche vide et conserve l’URL d’un import indisponible", async ({ page }) => {
  await page.route("**/api/gift-search?*", (route) => route.fulfill({ json: { status: "ok", products: [] } }));
  await openGiftSearch(page);
  await page.getByRole("searchbox", { name: "Nom du produit" }).fill("objet introuvable");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Aucun produit trouvé." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Autres idées cadeaux" })).toBeVisible();
  await page.getByRole("link", { name: "Importer un lien" }).click();
  await expect(page).toHaveURL(/\/mes-cadeaux\/nouveau#gift-product-link$/);

  const url = "https://example.org/cadeau-" + randomUUID().slice(0, 8);
  await expect(page.getByLabel("Lien vers un produit")).toBeEditable();
  await page.getByLabel("Lien vers un produit").evaluate((input, pastedUrl) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", pastedUrl);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: clipboardData });
    input.dispatchEvent(paste);
  }, url);
  await expect(page.getByRole("status").filter({ hasText: "Lien ajouté." })).toBeVisible();
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await db.connect();
    const failure = await db.query("select merchant, attempt_count from santa.gift_import_failures where url=$1", [url]);
    expect(failure.rows).toEqual([{ merchant: "example.org", attempt_count: "1" }]);
  } finally {
    await db.end();
  }
  const name = "Idée avec lien QA " + randomUUID().slice(0, 8);
  await page.getByRole("textbox", { name: "Nom du cadeau" }).fill(name);
  await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue("");
  await page.getByRole("button", { name: "Enregistrer le cadeau" }).click();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name }) });
  await expect(card.getByRole("link", { name: /Voir le produit/ })).toHaveAttribute("href", url);
});

test("enregistre un cadeau manuel avec le nom seul", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Ma liste", exact: true }).click();
  await page.getByRole("link", { name: "Ajouter un cadeau", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  const name = "Idée manuelle QA " + randomUUID().slice(0, 8);
  await page.getByRole("textbox", { name: "Nom du cadeau" }).fill(name);
  await page.getByRole("button", { name: "Enregistrer le cadeau" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
});
test("le catalogue renvoie des fiches marchandes uniquement aux comptes connectés", async ({ page }) => {
  const path = "/api/gift-search?q=skyjo";
  expect((await page.request.get(path)).status()).toBe(401);
  await openGiftSearch(page);
  await page.getByRole("button", { name: /Choisir STRIMMIG/ }).click();
  await expect(page.getByRole("textbox", { name: "Nom du cadeau" })).toHaveValue(/STRIMMIG/);
  await page.getByRole("searchbox", { name: "Nom du produit" }).fill("skyjo");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /\d+ produits? trouvés/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Choisir .*Skyjo/ }).first()).toBeVisible();
  const response = await page.request.get(path);
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const payload = await response.json();
  expect(payload.status).toBe("ok");
  expect(payload.products).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: expect.stringContaining("Skyjo"), url: expect.stringContaining("fnac.com") }),
  ]));
});
