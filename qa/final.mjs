import { api, iso, launch, newUser, BASE } from "./lib.mjs";
const S = process.argv[2];
const browser = await launch();
for (const kind of ["mobile", "desktop"]) {
  const { ctx, page } = await newUser(browser, kind);
  await page.goto(BASE + "/");
  await page.screenshot({ path: `${S}/${kind}-final-landing.png` });
  const trip = await api(page, "POST", "/api/trips", { title: "도쿄 4박 5일", destination: "도쿄", timezone: "Asia/Tokyo", startDate: iso(0), endDate: iso(4), travelerCount: 2, currency: "KRW", budgetAmount: 1500000 });
  await api(page, "POST", `/api/trips/${trip.id}/plan/generate`, { mode: "fill_empty" });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${S}/${kind}-final-dashboard.png` });
  await page.goto(`${BASE}/trips/${trip.id}/plan`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${S}/${kind}-final-plan.png` });
  await ctx.close();
}
await browser.close();
console.log("done");
