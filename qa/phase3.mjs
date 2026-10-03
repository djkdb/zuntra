import { api, iso, launch, newUser, BASE } from "./lib.mjs";
const S = process.argv[2];
const browser = await launch();
for (const kind of ["mobile", "desktop"]) {
  const { ctx, page } = await newUser(browser, kind);
  page.on("console", (m) => { if (m.type() === "error") console.log(`[${kind}]`, m.text().slice(0, 300)); });
  const trip = await api(page, "POST", "/api/trips", { title: "도쿄 4박 5일", destination: "도쿄", timezone: "Asia/Tokyo", startDate: iso(10), endDate: iso(14), travelerCount: 2, currency: "KRW", budgetAmount: 2000000, preferredFoods: ["라멘", "스시"], styles: ["FOOD", "PHOTO"], pace: "RELAXED" });
  await page.goto(`${BASE}/trips/${trip.id}/plan`);
  await page.getByRole("button", { name: "AI로 이 날 일정 만들기" }).click();
  await page.getByText("비어 있는 날 채우기").click();
  await page.getByLabel("AI에게 바라는 점").fill("맛집과 카페를 좋아하고 너무 빡빡한 일정은 싫어.");
  await page.screenshot({ path: `${S}/${kind}-p3-dialog.png` });
  await page.getByRole("button", { name: "일정 만들기" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${S}/${kind}-p3-loading.png` });
  await page.getByText(/일정을 만들었어요/).waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${S}/${kind}-p3-generated.png`, fullPage: true });
  await page.getByRole("button", { name: "AI로 일정 다시 맞추기" }).click();
  await page.getByRole("button", { name: "피곤해요" }).click();
  await page.getByRole("button", { name: "제안 받기" }).click();
  await page.getByRole("button", { name: /적용하기|확인/ }).waitFor();
  await page.screenshot({ path: `${S}/${kind}-p3-reschedule.png` });
  await ctx.close();
}
await browser.close();
console.log("done");
