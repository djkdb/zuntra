// Times trip tab switches in the browser (click → new tab rendered). HOVER=1 hovers first.
import { api, iso, launch, newUser, BASE } from "./lib.mjs";
const browser = await launch();
const { page } = await newUser(browser, "desktop");
const trip = await api(page, "POST", "/api/trips", { title: "도쿄", destination: "도쿄", timezone: "Asia/Tokyo", startDate: iso(0), endDate: iso(3), travelerCount: 2, currency: "JPY", budgetAmount: 200000 });
await api(page, "POST", `/api/trips/${trip.id}/plan/generate`, { mode: "fill_empty" });
await page.goto(`${BASE}/trips/${trip.id}`);

await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
const tabs = ["일정", "경비", "준비물", "기록", "AI 동행", "개요", "일정", "경비"];
const nav = page.getByRole("navigation", { name: "여행 메뉴" });
const times = [];


page.on("requestfinished", async (r) => { if (["fetch","xhr"].includes(r.resourceType())) { const t = r.timing(); console.log("rsc", new URL(r.url()).pathname, Math.round(t.responseEnd), "ms", r.headers()["next-router-prefetch"] ? "(prefetch)" : ""); } });
for (const t of tabs) {
  if (process.env.HOVER) { await nav.getByRole("link", { name: t }).hover(); await page.waitForTimeout(300); }
  const ms = await page.evaluate((name) => new Promise((resolve) => {
    const link = [...document.querySelectorAll('nav[aria-label="여행 메뉴"] a')].find((a) => a.textContent.includes(name));
    const t0 = performance.now();
    const check = () => {
      const cur = document.querySelector('nav[aria-label="여행 메뉴"] a[aria-current="page"]');
      const main = document.querySelector("#main");
      if (cur?.textContent.includes(name) && !main.querySelector('[data-slot="skeleton"].h-9')) resolve(Math.round(performance.now() - t0));
      else requestAnimationFrame(check);
    };
    link.click();
    requestAnimationFrame(check);
  }), t);
  times.push(`${t}:${ms}ms`);
  await page.waitForTimeout(300);
}
console.log(times.join("  "));
await browser.close();
