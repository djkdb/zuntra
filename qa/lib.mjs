// Manual QA helpers (screenshots of real flows). Not part of the test suite.
import { chromium, devices } from "@playwright/test";

export const BASE = process.env.QA_BASE ?? "http://localhost:3000";
export const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

export async function launch() {
  return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
}

export async function newUser(browser, kind = "mobile") {
  const ctx = await browser.newContext({ ...(kind === "mobile" ? devices["Pixel 7"] : { viewport: { width: 1440, height: 900 } }), locale: "ko-KR", timezoneId: "Asia/Seoul", ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/signup");
  await page.getByLabel("이름").fill("서연");
  await page.getByLabel("이메일").fill(`qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await page.getByLabel("비밀번호").fill("travel123");
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.waitForURL(/onboarding/);
  await page.getByText("맛집 중심").click();
  await page.getByText("사진", { exact: true }).click();
  await page.getByRole("button", { name: "여행 프로필 저장하고 시작하기" }).click();
  await page.waitForURL(/dashboard/);
  return { ctx, page };
}

export async function api(page, method, path, body) {
  const res = await page.request.fetch(BASE + path, { method, data: body, headers: body ? { "content-type": "application/json" } : {} });
  const json = res.status() === 204 ? null : await res.json();
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${JSON.stringify(json)}`);
  return json?.data;
}
