import { api, iso, launch, newUser, BASE } from "./lib.mjs";
const S = process.argv[2];
const browser = await launch();
for (const kind of ["mobile", "desktop"]) {
  const { ctx, page } = await newUser(browser, kind);
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[${kind} console.${m.type()}]`, m.text().slice(-700)); });
  const trip = await api(page, "POST", "/api/trips", { title: "도쿄 4박 5일", destination: "도쿄", timezone: "Asia/Tokyo", startDate: iso(0), endDate: iso(4), travelerCount: 2, currency: "JPY", budgetAmount: 300000 });
  const d1 = trip.days[0].id;
  const add = (b) => api(page, "POST", `/api/trips/${trip.id}/items`, { dayId: d1, category: "SIGHTSEEING", durationMinutes: 60, ...b });
  await add({ title: "아사쿠사 센소지", category: "CULTURE", startMinute: 540, durationMinutes: 90, latitude: 35.7148, longitude: 139.7967, address: "2-3-1 Asakusa, Taito" });
  await add({ title: "점심 · 텐동", category: "FOOD", startMinute: 690, estimatedCost: 1800, latitude: 35.7119, longitude: 139.7965 });
  await add({ title: "우에노 공원", category: "NATURE", startMinute: 840, durationMinutes: 90, latitude: 35.7156, longitude: 139.7745 });
  await add({ title: "아메요코 시장", category: "SHOPPING", startMinute: 960, durationMinutes: 90, latitude: 35.7101, longitude: 139.7745 });
  await page.goto(`${BASE}/trips/${trip.id}/plan`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${S}/${kind}-p2-plan.png`, fullPage: true });
  // Extend 우에노 to 3h20m to trigger the delay alert
  await page.getByRole("button", { name: /^우에노 공원 자연/ }).click();
  await page.getByLabel("예상 체류시간").selectOption("180");
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${S}/${kind}-p2-alert.png`, fullPage: true });
  await page.getByRole("button", { name: "자동 조정" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${S}/${kind}-p2-adjusted.png`, fullPage: true });
  // Keyboard drag: move last item up
  const handle = page.getByRole("button", { name: "아메요코 시장 순서 이동" });
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Space");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${S}/${kind}-p2-dragged.png`, fullPage: true });
  await page.getByRole("button", { name: "일정 추가" }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${S}/${kind}-p2-dialog.png` });
  await ctx.close();
}
await browser.close();
console.log("done");
