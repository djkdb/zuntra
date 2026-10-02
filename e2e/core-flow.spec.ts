import { expect, test } from "@playwright/test";
import { PASSWORD, createTrip, isoDaysFromNow, signUpAndOnboard, uniqueEmail } from "./helpers";

test("landing explains the product and leads to signup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("여행을 함께 준비하세요.");
  await expect(page.getByRole("link", { name: "데모 여행 둘러보기" }).first()).toBeVisible();
  await page.getByRole("link", { name: "여행 시작하기" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("demo trip is viewable without an account", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Tokyo 5 Days" })).toBeVisible();
  await expect(page.getByText("팀랩 플래닛")).toBeVisible();
});

test("protected pages redirect to login with a safe callback", async ({ page }) => {
  await page.goto("/trips/new");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Ftrips%2Fnew/);
});

test("signup → onboarding → create, edit and delete a trip", async ({ page }) => {
  const email = uniqueEmail("flow");
  await signUpAndOnboard(page, email);
  await expect(page.getByRole("heading", { name: "첫 여행을 만들어보세요." })).toBeVisible();

  const start = isoDaysFromNow(30);
  const end = isoDaysFromNow(34);
  await page.goto("/trips/new");
  // Profile preferences pre-fill the trip form.
  await expect(page.getByLabel("맛집 중심")).toBeChecked();
  await page.getByLabel("여행지").fill("도쿄");
  await page.getByLabel("출발일").fill(start);
  await page.getByLabel("귀국일").fill(end);
  await expect(page.getByText("4박 5일")).toBeVisible();
  await expect(page.getByLabel("여행 이름")).toHaveValue("도쿄 4박 5일");
  await expect(page.getByLabel("현지 시간대")).toHaveValue("Asia/Tokyo");
  await page.getByLabel("총 예산").fill("1,500,000");
  await page.getByRole("button", { name: "여행 만들기" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "도쿄 4박 5일" })).toBeVisible();
  await expect(page.getByText("여행을 만들었어요!")).toBeVisible();
  await expect(page.getByText("DAY 5")).toBeVisible();
  await expect(page.getByText("₩1,500,000")).toBeVisible();
  const tripUrl = page.url().split("?")[0]!;

  // Dashboard shows it as the upcoming focus trip.
  await page.goto("/dashboard");
  await expect(page.locator("#main").getByText("다가오는 여행 · D-30")).toBeVisible();

  // Edit: shrink by one day and rename.
  await page.goto(`${tripUrl}/edit`);
  await page.getByLabel("여행 이름").fill("도쿄 먹방 여행");
  await page.getByLabel("귀국일").fill(isoDaysFromNow(33));
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "도쿄 먹방 여행" })).toBeVisible();
  await expect(page.getByText("DAY 4")).toBeVisible();
  await expect(page.getByText("DAY 5")).toHaveCount(0);

  // Delete with confirmation.
  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제하기" }).click();
  await expect(page).toHaveURL(/\/trips(\?|$)/);
  await expect(page.getByText("첫 여행을 만들어보세요.")).toBeVisible();
});

test("form errors keep what the user typed", async ({ page }) => {
  await signUpAndOnboard(page, uniqueEmail("errors"));
  await page.goto("/trips/new");
  await page.getByLabel("여행지").fill("교토");
  await page.getByLabel("출발일").fill(isoDaysFromNow(10));
  await page.getByLabel("귀국일").fill(isoDaysFromNow(12));
  await page.getByLabel("총 예산").fill("-5");
  await page.getByLabel("추가 메모").fill("료칸에서 하루 쉬고 싶어요");
  await page.getByRole("button", { name: "여행 만들기" }).click();
  await expect(page.getByText("예산은 0 이상의 숫자로 입력해 주세요.")).toBeVisible();
  await expect(page.getByLabel("여행지")).toHaveValue("교토");
  await expect(page.getByLabel("추가 메모")).toHaveValue("료칸에서 하루 쉬고 싶어요");
});

test("another user cannot open someone else's trip", async ({ browser }) => {
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signUpAndOnboard(ownerPage, uniqueEmail("owner"));
  await createTrip(ownerPage, { destination: "부산", start: isoDaysFromNow(5), end: isoDaysFromNow(6) });
  const tripUrl = new URL(ownerPage.url()).pathname;

  const intruder = await browser.newContext();
  const intruderPage = await intruder.newPage();
  await signUpAndOnboard(intruderPage, uniqueEmail("intruder"));
  const response = await intruderPage.goto(tripUrl);
  expect(response?.status()).toBe(404);
  await expect(intruderPage.getByRole("heading", { name: "길을 잃었어요" })).toBeVisible();

  const api = await intruderPage.request.get(`/api${tripUrl}`);
  expect(api.status()).toBe(404);

  await owner.close();
  await intruder.close();
});

test("login rejects a wrong password and accepts the right one", async ({ page, browser }) => {
  const email = uniqueEmail("login");
  await signUpAndOnboard(page, email);

  // A fresh browser context = a signed-out device.
  const device = await browser.newContext();
  page = await device.newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("wrong-password1");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않아요.")).toBeVisible();
  await expect(page.getByLabel("이메일")).toHaveValue(email);

  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await device.close();
});
