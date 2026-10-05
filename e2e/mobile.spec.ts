import { expect, test } from "@playwright/test";
import { createTrip, isoDaysFromNow, signUpAndOnboard, uniqueEmail } from "./helpers";

test("mobile shows bottom navigation that follows the current trip", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only layout");
  await signUpAndOnboard(page, uniqueEmail("mobile"));
  await createTrip(page, { destination: "제주", start: isoDaysFromNow(3), end: isoDaysFromNow(5) });
  const tripPath = new URL(page.url()).pathname;

  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "AI" })).toHaveAttribute("href", `${tripPath}/companion`);
  await expect(nav.getByRole("link", { name: "지도" })).toHaveAttribute("href", `${tripPath}/map`);

  // The rest of the trip's sections sit behind "더보기".
  await nav.getByRole("button", { name: "더보기" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "준비물" })).toHaveAttribute("href", `${tripPath}/packing`);
  await page.keyboard.press("Escape");

  // No horizontal scrolling at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
