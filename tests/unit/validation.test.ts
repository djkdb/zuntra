import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/validation/auth";
import { fieldErrors, formDataToObject } from "@/lib/validation/common";
import { travelProfileSchema } from "@/lib/validation/profile";
import { createTripSchema, updateTripSchema } from "@/lib/validation/trip";

const validTrip = {
  title: "도쿄 4박 5일",
  destination: "도쿄",
  timezone: "Asia/Tokyo",
  startDate: "2026-11-03",
  endDate: "2026-11-07",
  travelerCount: "2",
  styles: ["FOOD", "FOOD", "CAFE_NOT_REAL"].slice(0, 2),
  currency: "KRW",
};

describe("createTripSchema", () => {
  it("accepts form-shaped input and normalizes it", () => {
    const parsed = createTripSchema.parse({
      ...validTrip,
      budgetAmount: "1,500,000",
      preferredPlaces: "시부야, 팀랩 ,시부야,",
      preferredFoods: "",
      purpose: "  ",
      pace: "",
    });
    expect(parsed.travelerCount).toBe(2);
    expect(parsed.styles).toEqual(["FOOD"]);
    expect(parsed.budgetAmount).toBe(1_500_000);
    expect(parsed.preferredPlaces).toEqual(["시부야", "팀랩"]);
    expect(parsed.preferredFoods).toEqual([]);
    expect(parsed.purpose).toBeUndefined();
    expect(parsed.pace).toBeUndefined();
  });

  it("rejects a return date before departure", () => {
    const result = createTripSchema.safeParse({ ...validTrip, endDate: "2026-11-01" });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).endDate).toBe("귀국일은 출발일 이후여야 해요.");
  });

  it("caps trips at 30 days", () => {
    const result = createTripSchema.safeParse({ ...validTrip, endDate: "2026-12-03" });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).endDate).toContain("최대 30일");
  });

  it.each([
    ["invalid date", { startDate: "2026-02-30" }, "startDate"],
    ["unknown time zone", { timezone: "Mars/Base" }, "timezone"],
    ["zero travelers", { travelerCount: "0" }, "travelerCount"],
    ["negative budget", { budgetAmount: "-1" }, "budgetAmount"],
    ["unsupported currency", { currency: "XYZ" }, "currency"],
    ["unknown style", { styles: ["HACKING"] }, "styles.0"],
    ["missing title", { title: "   " }, "title"],
  ])("rejects %s", (_name, patch, field) => {
    const result = createTripSchema.safeParse({ ...validTrip, ...patch });
    expect(result.success).toBe(false);
    expect(Object.keys(fieldErrors(result.error!))).toContain(field);
  });

  it("keeps script-like text as plain data (rendering escapes it)", () => {
    const parsed = createTripSchema.parse({ ...validTrip, notes: "<script>alert(1)</script>" });
    expect(parsed.notes).toBe("<script>alert(1)</script>");
  });
});

describe("updateTripSchema", () => {
  it("allows partial patches and null to clear the budget", () => {
    expect(updateTripSchema.parse({ title: "새 이름" })).toEqual({ title: "새 이름" });
    expect(updateTripSchema.parse({ budgetAmount: null })).toEqual({ budgetAmount: null });
  });
});

describe("signUpSchema", () => {
  it("normalizes email and enforces password rules", () => {
    expect(signUpSchema.parse({ name: "민지", email: "  MinJi@Example.COM ", password: "travel123" }).email).toBe(
      "minji@example.com",
    );
    expect(signUpSchema.safeParse({ name: "a", email: "a@b.co", password: "short1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "a", email: "a@b.co", password: "onlyletters" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "a", email: "a@b.co", password: "12345678" }).success).toBe(false);
  });
});

describe("travelProfileSchema + formDataToObject", () => {
  it("parses repeated checkbox values into arrays", () => {
    const fd = new FormData();
    fd.append("name", "민지");
    fd.append("styles", "FOOD");
    fd.append("styles", "PHOTO");
    fd.append("pace", "RELAXED");
    fd.append("budgetLevel", "STANDARD");
    fd.append("favoriteFoods", "라멘, 스시");
    fd.append("companionType", "FRIENDS");
    const parsed = travelProfileSchema.parse(formDataToObject(fd, ["styles"]));
    expect(parsed.styles).toEqual(["FOOD", "PHOTO"]);
    expect(parsed.favoriteFoods).toEqual(["라멘", "스시"]);
  });

  it("requires at least one style", () => {
    const fd = new FormData();
    fd.append("name", "민지");
    const result = travelProfileSchema.safeParse(formDataToObject(fd, ["styles"]));
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).styles).toBeDefined();
  });
});
