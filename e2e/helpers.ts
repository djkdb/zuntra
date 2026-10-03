import { type Page, expect } from "@playwright/test";

/** Calendar date N days from today in Asia/Seoul (the browser time zone used by the tests). */
export function isoDaysFromNow(days: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export const PASSWORD = "travel123";

/** A created trip page (not /trips/new). */
export const TRIP_URL = /\/trips\/(?!new\b)[a-z0-9]+(\?|$)/;

export async function signUpAndOnboard(page: Page, email: string, name = "민지") {
  await page.goto("/signup");
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByText("맛집 중심").click();
  await page.getByText("사진", { exact: true }).click();
  await page.getByText("느긋하게").click();
  await page.getByLabel("좋아하는 음식").fill("라멘, 스시");
  await page.getByText("친구", { exact: true }).click();
  await page.getByRole("button", { name: "여행 프로필 저장하고 시작하기" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createTrip(page: Page, { destination, start, end }: { destination: string; start: string; end: string }) {
  await page.goto("/trips/new");
  await page.getByLabel("여행지").fill(destination);
  await page.getByLabel("출발일").fill(start);
  await page.getByLabel("귀국일").fill(end);
  await page.getByLabel("동행 인원").fill("2");
  await page.getByLabel("총 예산").fill("1500000");
  await page.getByRole("button", { name: "여행 만들기" }).click();
  await expect(page).toHaveURL(TRIP_URL);
}
