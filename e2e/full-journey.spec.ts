import { expect, test } from "@playwright/test";
import { TRIP_URL, isoDaysFromNow, signUpAndOnboard, uniqueEmail } from "./helpers";

/**
 * The complete journey from the product spec (§34):
 * 회원가입 → 여행 생성 → AI 일정 생성 → 일정 확인/수정 → AI에게 질문 → AI 일정 조정 →
 * 지도 → 날씨 → 경비 → 준비물 → 여행 기록 → 여행 종료 → AI 여행 리포트
 */
test("a traveler goes from signup to the AI travel report", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, uniqueEmail("journey"));

  // 여행 생성 (in progress today, so TODAY and the companion are live)
  await page.goto("/trips/new");
  await page.getByLabel("여행지").fill("도쿄");
  await page.getByLabel("출발일").fill(isoDaysFromNow(0));
  await page.getByLabel("귀국일").fill(isoDaysFromNow(3));
  await page.getByLabel("총 예산").fill("1500000");
  await page.getByLabel("추가 메모").fill("너무 빡빡한 일정은 싫어요.");
  await page.getByRole("button", { name: "여행 만들기" }).click();
  await expect(page).toHaveURL(TRIP_URL);
  const tripPath = new URL(page.url()).pathname;

  // 날씨 (overview, tied to the plan)
  await expect(page.getByRole("heading", { name: "여행 날씨" })).toBeVisible();

  // AI 일정 생성
  await page.goto(`${tripPath}/plan`);
  await page.getByRole("button", { name: "AI로 이 날 일정 만들기" }).click();
  await page.getByText("비어 있는 날 채우기").click();
  await page.getByLabel("AI에게 바라는 점").fill("맛집과 카페를 좋아하고 너무 빡빡한 일정은 싫어.");
  await page.getByRole("button", { name: "일정 만들기" }).click();
  await expect(page.getByText(/일정을 만들었어요/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("list", { name: / 일정$/ }).getByRole("listitem").first()).toBeVisible();

  // 일정 수정: add one and mark it done
  await page.getByRole("button", { name: "일정 추가" }).first().click();
  await page.getByLabel("장소 또는 할 일").fill("편의점 쇼핑");
  await page.getByLabel("시작 시간").fill("22:00");
  await page.getByRole("button", { name: "추가하기" }).click();
  await expect(page.getByText("일정을 추가했어요.")).toBeVisible();
  await page.getByRole("button", { name: "편의점 쇼핑 완료로 표시" }).click();
  await expect(page.getByRole("button", { name: "편의점 쇼핑 완료 취소" })).toBeVisible();

  // AI 일정 조정 (preview → apply)
  await page.getByRole("button", { name: "AI 일정 조정" }).click();
  await page.getByRole("button", { name: "피곤해요" }).click();
  await page.getByRole("button", { name: "제안 받기" }).click();
  const apply = page.getByRole("button", { name: /^(적용하기|확인)$/ });
  await expect(apply).toBeVisible({ timeout: 20_000 });
  await apply.click();

  // AI에게 질문 → 제안 승인
  await page.goto(`${tripPath}/companion`);
  // Typing before hydration finishes gets reset by React; retry until the send button wakes up.
  const chatInput = page.getByLabel("AI에게 메시지 보내기");
  await expect(async () => {
    await chatInput.fill("밥 먹고 어디 가지?");
    await expect(page.getByRole("button", { name: "보내기", exact: true })).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await chatInput.press("Enter");
  const addAction = page.getByRole("button", { name: "일정에 추가" });
  await expect(addAction).toBeVisible({ timeout: 20_000 });
  await addAction.click();
  await expect(page.getByText("적용했어요")).toBeVisible();

  // 지도
  await page.goto(`${tripPath}/map`);
  await expect(page.getByRole("application", { name: "여행 지도" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "날짜 필터" })).toBeVisible();

  // 경비
  await page.goto(`${tripPath}/budget`);
  await page.getByRole("button", { name: "지출 기록" }).first().click();
  // Abroad, the form starts in the local currency and shows the converted amount.
  await expect(page.getByLabel("통화")).toHaveValue("JPY");
  await page.getByLabel("금액", { exact: true }).fill("1,000");
  await expect(page.getByText(/≈ ₩[\d,]+/)).toBeVisible();
  await page.getByLabel("통화").selectOption("KRW");
  await page.getByLabel("금액", { exact: true }).fill("12,000");
  await page.getByLabel("내용").fill("이치란 라멘");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("지출을 기록했어요.")).toBeVisible();
  await expect(page.getByText("₩12,000").first()).toBeVisible();

  // 준비물
  await page.goto(`${tripPath}/packing`);
  await page.getByRole("button", { name: "AI로 체크리스트 만들기" }).click();
  await expect(page.getByText(/준비물 \d+개를 추가했어요/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("checkbox", { name: "여권 챙김" }).click();
  await expect(page.getByRole("checkbox", { name: "여권 챙김" })).toHaveAttribute("aria-checked", "true");

  // 여행 기록
  await page.goto(`${tripPath}/journal`);
  await page.getByLabel("기록 내용").fill("오늘 시부야에서 먹은 라멘 진짜 맛있었다.");
  await page.getByRole("radio", { name: "5점" }).click();
  await page.getByRole("button", { name: "기록하기" }).click();
  await expect(page.getByRole("article").filter({ hasText: "라멘 진짜 맛있었다" })).toBeVisible();

  // 여행 종료 → AI 여행 리포트
  await page.getByRole("button", { name: "여행 종료하고 리포트 만들기" }).click();
  await page.getByRole("button", { name: "여행 종료하기" }).click();
  await expect(page).toHaveURL(new RegExp(`${tripPath}/report$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "AI 여행 회고" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /여행$/ }).first()).toBeVisible();
  await expect(page.getByText("₩12,000").first()).toBeVisible();
});
