import { describe, expect, it } from "vitest";
import { josa, withJosa } from "@/lib/korean";

describe("josa", () => {
  it("picks particles by the final consonant", () => {
    expect(withJosa("여권", "을/를")).toBe("여권을");
    expect(withJosa("카메라", "을/를")).toBe("카메라를");
    expect(withJosa("오사카", "이/가")).toBe("오사카가");
    expect(withJosa("도쿄 타워", "은/는")).toBe("도쿄 타워는");
  });
  it("handles 으로/로 with ㄹ as no final consonant", () => {
    expect(josa("서울", "으로/로")).toBe("로");
    expect(josa("부산", "으로/로")).toBe("으로");
    expect(josa("나라", "으로/로")).toBe("로");
  });
  it("reads numbers and money", () => {
    expect(withJosa("₩7,500", "을/를")).toBe("₩7,500을");
    expect(withJosa("¥1,202", "을/를")).toBe("¥1,202를");
    expect(josa("₩1,000,001", "으로/로")).toBe("로");
  });
});

import { parseAmountText } from "@/lib/format";

describe("parseAmountText", () => {
  it("reads Korean amounts", () => {
    expect(parseAmountText("60만원")).toBe(600000);
    expect(parseAmountText("150만")).toBe(1500000);
    expect(parseAmountText("1,500,000")).toBe(1500000);
    expect(parseAmountText("3.5만")).toBe(35000);
    expect(parseAmountText("1억 2천만")).toBe(120000000);
    expect(parseAmountText("1만2천")).toBe(12000);
    expect(parseAmountText("800엔")).toBe(800);
  });
  it("rejects junk", () => {
    expect(parseAmountText("abc")).toBeNaN();
    expect(parseAmountText("")).toBeNaN();
    expect(parseAmountText("만원만")).toBeNaN();
  });
});

import { isDomesticTrip } from "@/lib/timezone-guess";

describe("isDomesticTrip", () => {
  it("trusts the destination over the stored time zone", () => {
    expect(isDomesticTrip("오사카", "Asia/Seoul")).toBe(false);
    expect(isDomesticTrip("제주", "Asia/Seoul")).toBe(true);
    expect(isDomesticTrip("어딘가 작은 마을", "Asia/Seoul")).toBe(true);
    expect(isDomesticTrip("어딘가 작은 마을", "Europe/Paris")).toBe(false);
  });
});
