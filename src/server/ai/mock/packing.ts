import "server-only";
import type { PackingContext } from "../prompts/packing";
import type { PackingList } from "../schemas/packing";

type Item = PackingList["items"][number];
const it = (name: string, group: Item["group"], quantity = 1, reason: string | null = null): Item => ({ name, group, quantity, reason });

/** Rule-based packing list: documents, basics, clothes by nights, weather and personal extras. */
export function mockPacking(ctx: PackingContext): PackingList {
  const n = Math.max(ctx.nights, 1);
  const items: Item[] = [
    ...(ctx.domestic ? [it("신분증", "필수 서류")] : [it("여권", "필수 서류"), it("항공권·예약 확인서", "필수 서류"), it("해외 결제 카드", "필수 서류"), it("현지 통화 소액 현금", "필수 서류")]),
    it("지갑", "기본"),
    it("숙소 예약 정보", "기본"),
    it("휴대폰 충전기", "전자기기"),
    it("보조배터리", "전자기기"),
    ...(ctx.domestic ? [] : [it("멀티 어댑터", "전자기기"), it("eSIM 또는 유심", "전자기기")]),
    it("상의", "의류", Math.min(n + 1, 7)),
    it("하의", "의류", Math.min(Math.ceil(n / 2) + 1, 4)),
    it("속옷·양말", "의류", Math.min(n + 1, 8)),
    it("잠옷", "의류"),
    it("편한 운동화", "의류", 1, null),
    it("칫솔·치약", "세면·건강"),
    it("상비약 (소화제·진통제·밴드)", "세면·건강"),
    it("선크림", "세면·건강"),
  ];
  const { weather } = ctx;
  if (weather.rainyDays > 0) items.push(it("우산", "날씨", 1, `비 예보가 ${weather.rainyDays}일 있어요.`));
  if (weather.known && weather.minTemp !== null && weather.minTemp < 15) items.push(it("얇은 겉옷", "날씨", 1, `최저 ${weather.minTemp}°C로 쌀쌀해요.`));
  if (weather.known && weather.minTemp !== null && weather.minTemp < 5) items.push(it("패딩·장갑", "날씨", 1, "기온이 낮아요."));
  if (weather.known && weather.maxTemp !== null && weather.maxTemp >= 27) items.push(it("모자·선글라스", "날씨", 1, `최고 ${weather.maxTemp}°C로 더워요.`));
  if (weather.snowy) items.push(it("방수 신발", "날씨", 1, "눈 예보가 있어요."));
  if (!weather.known) items.push(it("얇은 겉옷", "날씨", 1, "일교차에 대비해요."));

  if (ctx.styles.includes("PHOTO")) items.push(it("카메라·여분 배터리", "맞춤", 1, "사진 여행 스타일이에요."));
  if (ctx.styles.includes("NATURE") || ctx.plannedCategories.includes("NATURE")) items.push(it("트레킹화·물병", "맞춤", 1, "자연 일정이 있어요."));
  if (ctx.styles.includes("SHOPPING")) items.push(it("접이식 장바구니", "맞춤", 1, "쇼핑할 짐을 대비해요."));
  if (ctx.styles.includes("ACTIVITY")) items.push(it("활동하기 편한 옷", "맞춤", 1, "액티비티 일정이 있어요."));
  if (/해변|바다|수영|beach|비치|해수욕/i.test(`${ctx.destination} ${ctx.notes ?? ""}`) || ctx.plannedCategories.includes("BEACH")) {
    items.push(it("수영복·비치타월", "맞춤", 1, "물놀이 계획이 있어요."));
  }
  const noteItems = /유니폼|축구|야구|공연|콘서트|등산|골프|스키/.exec(ctx.notes ?? "");
  if (noteItems) items.push(it(`${noteItems[0]} 관련 준비물`, "맞춤", 1, "메모에 적어 둔 계획이에요."));

  const existing = new Set(ctx.existing.map((e) => e.trim()));
  return { items: items.filter((i) => !existing.has(i.name)) };
}
