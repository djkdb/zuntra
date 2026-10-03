import { api, iso, launch, newUser, BASE } from "./lib.mjs";
const browser = await launch();
const { ctx, page } = await newUser(browser, "mobile");
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_TOO/.test(m.text())) console.log("[console]", m.text().slice(0, 200)); });
const trip = await api(page, "POST", "/api/trips", { title: "도쿄", destination: "도쿄", timezone: "Asia/Tokyo", startDate: iso(0), endDate: iso(2), travelerCount: 2, currency: "JPY", budgetAmount: 200000 });
console.log("trip", trip.days.length, "days");
const plan = await api(page, "POST", `/api/trips/${trip.id}/plan/generate`, { mode: "fill_empty" });
console.log("plan", plan.days.map((d) => d.items.length).join(","));
const chat = await api(page, "POST", `/api/trips/${trip.id}/companion`, { message: "밥 먹고 어디 가지?" });
console.log("companion", chat.messages[1].content.slice(0, 60), "| actions", chat.messages[1].actions.length);
await api(page, "POST", `/api/trips/${trip.id}/expenses`, { title: "라멘", category: "FOOD", amount: 1200, date: iso(0) });
const weather = await api(page, "GET", `/api/trips/${trip.id}/weather`);
console.log("weather", weather.provider, weather.days.filter((d) => d.available).length, "days");
for (const path of ["", "/plan", "/companion", "/budget", "/map", "/packing", "/journal"]) {
  const res = await page.goto(`${BASE}/trips/${trip.id}${path}`);
  console.log(path || "/overview", res.status());
}
await ctx.close();
await browser.close();
