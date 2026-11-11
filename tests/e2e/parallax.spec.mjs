import { expect, test } from "@playwright/test";

test("anime les cadeaux à la souris et respecte le mouvement réduit", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const foreground = page.locator('.wrapping g[class*="frontGift"]');
  await expect(foreground).toBeVisible();
  await expect(page.locator(".wrapping")).toHaveAttribute("style", /--gift-parallax/);
  const before = await foreground.evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(50, 50);
  await expect.poll(() => foreground.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(foreground).toHaveCSS("transform", "none");
  await page.mouse.move(1200, 800);
  await expect(foreground).toHaveCSS("transform", "none");
});
