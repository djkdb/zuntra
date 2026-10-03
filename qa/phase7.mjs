import { execSync } from "node:child_process";
import { devices } from "@playwright/test";
import { BASE, launch, newUser } from "./lib.mjs";
const S = process.argv[2];
const browser = await launch();
for (const [kind, opts] of [["mobile", devices["Pixel 7"]], ["desktop", { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await browser.newContext({ ...opts, locale: "ko-KR", ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_TOO_MANY/.test(m.text())) console.log(`[${kind}]`, m.text().slice(0, 300)); });
  await page.goto(BASE + "/demo");
  await page.getByRole("heading", { name: "TODAY" }).waitFor();
  await page.screenshot({ path: `${S}/${kind}-p7-demo-today.png`, fullPage: true });
  await page.getByRole("tab", { name: "AI 동행" }).click();
  await page.getByRole("button", { name: "지금 너무 피곤해" }).click();
  await page.getByText(/일정이 \d개 남아/).waitFor({ timeout: 15000 });
  const approve = page.getByRole("button", { name: "일정 줄이기" });
  if (await approve.count()) await approve.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${S}/${kind}-p7-demo-ai.png`, fullPage: true });
  await page.getByRole("tab", { name: "경비" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${S}/${kind}-p7-demo-budget.png`, fullPage: true });
  await ctx.close();
}
// Admin
const { ctx, page } = await newUser(browser, "desktop");
const email = await page.locator("aside").getByText(/@example.com/).innerText();
execSync(`npx tsx scripts/grant-admin.ts ${email}`, { stdio: "inherit" });
await page.goto(BASE + "/admin");
await page.getByText("서비스 지표").waitFor();
await page.screenshot({ path: `${S}/desktop-p7-admin.png`, fullPage: true });
await ctx.close();
await browser.close();
console.log("done");
