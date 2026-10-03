import "server-only";
import type { PlaceCategory } from "@/generated/prisma/enums";
import { type LatLng, estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { formatMinute } from "@/lib/itinerary";
import { formatDelay, reflowDay } from "@/lib/schedule";
import type { CompanionContext, ContextItem } from "../context/trip-context";
import type { CompanionActionDraft, CompanionReply } from "../schemas/companion";
import { type Poi, findCity } from "./poi-catalog";

export interface MockCompanionInput {
  ctx: CompanionContext;
  message: string;
}

const action = (partial: Partial<CompanionActionDraft> & Pick<CompanionActionDraft, "type" | "label">): CompanionActionDraft => ({
  ref: null,
  dayNumber: null,
  title: null,
  category: null,
  startTime: null,
  durationMinutes: null,
  address: null,
  latitude: null,
  longitude: null,
  amount: null,
  text: null,
  mood: null,
  rating: null,
  ...partial,
});

const LOW_PRIORITY: PlaceCategory[] = ["SHOPPING", "CAFE", "ACTIVITY", "SIGHTSEEING", "NATURE", "CULTURE"];

function remaining(ctx: CompanionContext): ContextItem[] {
  const now = ctx.focusDay?.isToday ? ctx.now.minute : -1;
  return ctx.items.filter((i) => i.status !== "DONE" && (i.ref === ctx.currentRef || i.startMinute + i.durationMinutes > now));
}

function here(ctx: CompanionContext): LatLng | null {
  return ctx.location ?? ctx.items.find((i) => i.ref === ctx.currentRef)?.location ?? ctx.center;
}

function nearestPois(ctx: CompanionContext, categories: PlaceCategory[], opts: { indoor?: boolean; exclude?: string[] } = {}): Poi[] {
  const city = findCity(ctx.trip.destination);
  if (!city) return [];
  const from = here(ctx) ?? city.center;
  const planned = new Set([...ctx.items.map((i) => i.title), ...(opts.exclude ?? [])]);
  return city.pois
    .filter((p) => categories.includes(p.category) && !planned.has(p.name) && (opts.indoor === undefined || p.indoor === opts.indoor))
    .sort((a, b) => haversineKm(from, a) - haversineKm(from, b));
}

function placeFields(poi: Poi) {
  return { title: poi.name, category: poi.category, durationMinutes: poi.minutes, address: poi.address, latitude: poi.lat, longitude: poi.lng };
}

function travelText(ctx: CompanionContext, to: LatLng | null): string {
  const from = here(ctx);
  if (!from || !to) return "";
  const mode = suggestMode(from, to);
  return `${mode === "WALK" ? "도보" : "대중교통으로"} ${estimateTravelMinutes(from, to, mode)}분`;
}

function nowText(ctx: CompanionContext) {
  return ctx.focusDay?.isToday ? `현재 ${formatMinute(ctx.now.minute)}이고` : `Day ${ctx.focusDay?.dayNumber ?? 1} 기준으로`;
}

function extractMinutes(message: string): number {
  const hours = /(\d+(?:\.\d+)?)\s*시간/.exec(message);
  const minutes = /(\d+)\s*분/.exec(message);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  if (total > 0) return Math.min(Math.round(total), 240);
  if (/반\s*시간/.test(message)) return 30;
  return 60;
}

function extractAmount(message: string): number | null {
  const m = /(\d[\d,.]*)\s*(만\s*원|만|원|엔|달러|유로)?/.exec(message.replace(/\s+/g, " "));
  if (!m) return null;
  let n = Number(m[1]!.replace(/,/g, ""));
  if (m[2]?.startsWith("만")) n *= 10_000;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mockCompanion({ ctx, message }: MockCompanionInput): CompanionReply {
  const text = message.trim();
  const left = remaining(ctx);
  const current = ctx.items.find((i) => i.ref === ctx.currentRef) ?? null;
  const next = ctx.items.find((i) => i.ref === ctx.nextRef) ?? null;
  const edit = ctx.canEdit;
  const dayNumber = ctx.focusDay?.dayNumber ?? 1;

  // 1) Fatigue → drop one optional stop, head back to the hotel.
  if (/피곤|힘들|지쳤|지친|쉬고\s*싶|다리\s*아|졸려|tired/i.test(text)) {
    const victim = [...left]
      .filter((i) => i.ref !== ctx.currentRef && LOW_PRIORITY.includes(i.category))
      .sort((a, b) => LOW_PRIORITY.indexOf(a.category) - LOW_PRIORITY.indexOf(b.category))[0];
    const lodgingText = ctx.lodging?.travelMinutes
      ? `현재 위치에서 숙소까지 ${ctx.lodging.travelMinutes}분 정도 걸려요.`
      : "숙소 근처에서 쉬어 가는 것도 좋아요.";
    return {
      message: `${nowText(ctx)} 오늘 일정이 ${left.length}개 남아 있어요. ${lodgingText}\n${
        victim ? `오늘은 ‘${victim.title}’을(를) 빼고 숙소 근처에서 저녁을 먹는 걸 추천해요.` : "남은 일정은 가볍게 이어가는 걸 추천해요."
      } 어떻게 할까요?`,
      quickReplies: ["현재 일정 유지", "숙소로 이동"],
      actions: edit && victim ? [action({ type: "REMOVE_PLACE", label: "일정 줄이기", ref: victim.ref })] : [],
    };
  }

  // 2) "여기 너무 좋다. 1시간 더 있을래" → extend the current stop; later stops re-flow.
  if (/더\s*있|더\s*머물|연장|좋다|너무\s*좋아/.test(text)) {
    const target = current ?? next;
    if (target) {
      const extra = extractMinutes(text);
      const newDuration = target.durationMinutes + extra;
      const preview = reflowDay(
        ctx.items.map((i) => ({ ...i, id: i.ref, durationMinutes: i.ref === target.ref ? newDuration : i.durationMinutes })),
      );
      return {
        message: `좋아요! ‘${target.title}’에 ${formatDelay(extra)} 더 머물면 ${
          preview.changes.length > 0
            ? `이후 일정 ${preview.changes.length}개가 최대 ${formatDelay(preview.maxDelay)} 밀려요. 남은 일정을 자동으로 조정할까요?`
            : "다른 일정에는 영향이 없어요. 반영할까요?"
        }${preview.overflow.length ? " 다만 마지막 일정이 늦게 끝날 수 있어요." : ""}`,
        quickReplies: ["직접 수정할게", "다음 일정은?"],
        actions: edit
          ? [action({ type: "RESCHEDULE", label: preview.changes.length > 0 ? "자동 조정" : "반영하기", ref: target.ref, durationMinutes: newDuration })]
          : [],
      };
    }
  }

  // 3) Rain → indoor alternative for the next outdoor stop.
  if (/비\s*(가|와|오|올|예보)|우산|소나기|날씨/.test(text) || (/비/.test(text) && text.length < 10)) {
    const rainy = (ctx.weather?.precipitation ?? 0) >= 50 || ctx.rainyDayNumbers.includes(dayNumber);
    const outdoor = left.find((i) => i.isIndoor === false || ["NATURE", "SIGHTSEEING", "ACTIVITY"].includes(i.category));
    const indoor = nearestPois(ctx, ["CULTURE", "SIGHTSEEING", "SHOPPING", "ACTIVITY"], { indoor: true })[0];
    const weatherText = ctx.weather
      ? `오늘은 ${ctx.weather.condition}, ${ctx.weather.tempMin}–${ctx.weather.tempMax}°C${ctx.weather.precipitation !== null ? `, 강수확률 ${ctx.weather.precipitation}%` : ""}예요.`
      : "아직 날씨 정보를 받지 못했어요.";
    if ((rainy || /비/.test(text)) && outdoor && indoor) {
      return {
        message: `${weatherText} ‘${outdoor.title}’은(는) 야외 일정이라 비를 맞을 수 있어요. 대신 실내인 ‘${indoor.name}’(으)로 바꿀까요?${travelText(ctx, indoor) ? ` (${travelText(ctx, indoor)})` : ""}`,
        quickReplies: ["그대로 갈게", "다른 실내 장소"],
        actions: edit ? [action({ type: "REPLACE_PLACE", label: "실내 일정으로 변경", ref: outdoor.ref, ...placeFields(indoor) })] : [],
      };
    }
    return {
      message: `${weatherText} ${rainy ? "우산을 챙기세요." : "일정대로 다니기 좋아 보여요."}`,
      quickReplies: ["다음 일정은?"],
      actions: [],
    };
  }

  // 4) Closed / sold out → alternative.
  if (/휴무|문\s*닫|닫았|영업\s*안|만석|매진|웨이팅/.test(text)) {
    const target = current ?? next ?? left[0];
    const alt = target ? nearestPois(ctx, [target.category === "FOOD" ? "FOOD" : target.category])[0] ?? nearestPois(ctx, ["SIGHTSEEING", "CULTURE"])[0] : undefined;
    if (target && alt) {
      return {
        message: `아쉽네요. 근처에 ‘${alt.name}’이(가) 있어요${travelText(ctx, alt) ? ` (${travelText(ctx, alt)})` : ""}. ‘${target.title}’ 대신 가 볼까요?`,
        quickReplies: ["다른 곳 추천해줘"],
        actions: edit ? [action({ type: "SUGGEST_ALTERNATIVE", label: "대체 장소로 변경", ref: target.ref, ...placeFields(alt) })] : [],
      };
    }
  }

  // 5) Delay → move the next pending stop to now and let the day re-flow.
  if (/늦|지연|밀렸|놓쳤|연착|막혀/.test(text) && ctx.focusDay?.isToday) {
    const target = left.find((i) => i.ref !== ctx.currentRef && i.startMinute < ctx.now.minute + 15) ?? next;
    if (target) {
      const start = Math.ceil((ctx.now.minute + 15) / 5) * 5;
      return {
        message: `${nowText(ctx)} ‘${target.title}’은(는) ${formatMinute(start)}부터 시작하면 돼요. 이후 일정도 이동시간에 맞춰 함께 미룰까요?`,
        quickReplies: ["일정 하나 빼줘", "그대로 둘게"],
        actions: edit ? [action({ type: "RESCHEDULE", label: "일정 미루기", ref: target.ref, startTime: formatMinute(Math.min(start, 1435)) })] : [],
      };
    }
  }

  // 6) Food / "밥 먹고 어디 가지?"
  if (/밥|배고|먹|맛집|점심|저녁|식사|카페|커피|디저트/.test(text)) {
    const after = /먹고|다음|어디\s*가/.test(text) && !/뭐\s*먹|배고|맛집/.test(text);
    const wantsCafe = /카페|커피|디저트/.test(text);
    const cats: PlaceCategory[] = after ? ["SIGHTSEEING", "CULTURE", "NATURE", "SHOPPING"] : wantsCafe ? ["CAFE"] : ["FOOD"];
    const liked = ctx.profile.foods;
    const options = nearestPois(ctx, cats);
    const pick = (!after && liked.length ? options.find((p) => liked.some((f) => p.name.includes(f) || p.tags?.some((t) => t.includes(f)))) : undefined) ?? options[0];
    if (pick) {
      const start = ctx.focusDay?.isToday ? Math.ceil((ctx.now.minute + 20) / 5) * 5 : 12 * 60;
      const until = next ? `다음 일정(${formatMinute(next.startMinute)} ${next.title})까지 시간이 있어요.` : "오늘 남은 일정이 없어 여유 있게 들를 수 있어요.";
      return {
        message: `${after ? "식사 후에는" : "지금 위치에서"} ‘${pick.name}’ 어때요?${travelText(ctx, pick) ? ` ${travelText(ctx, pick)} 거리예요.` : ""} ${until}`,
        quickReplies: ["다른 곳은?", "일정에 넣어줘"],
        actions: edit
          ? [action({ type: "ADD_PLACE", label: "일정에 추가", dayNumber, startTime: formatMinute(Math.min(start, 1380)), ...placeFields(pick) })]
          : [],
      };
    }
  }

  // 7) Budget.
  if (/예산|돈|비용|지출|얼마|썼/.test(text)) {
    const { total, spent } = ctx.budget;
    const amount = /예산.*(으로|로)\s*(늘|줄|바꿔|변경|해)/.test(text) ? extractAmount(text) : null;
    const top = Object.entries(ctx.budget.byCategory).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    const fmt = (n: number) => `${Math.round(n).toLocaleString("ko-KR")} ${ctx.trip.currency}`;
    return {
      message:
        amount !== null
          ? `총 예산을 ${fmt(amount)}(으)로 바꿀까요?`
          : total
            ? `지금까지 ${fmt(spent)}을(를) 써서 예산의 ${Math.round((spent / total) * 100)}%를 사용했어요.${top ? ` 가장 많이 쓴 항목은 ${categoryLabel(top[0])}이에요.` : ""}`
            : `지금까지 ${fmt(spent)}을(를) 썼어요. 예산을 정해 두면 사용률을 알려드릴게요.`,
      quickReplies: ["경비 기록하기"],
      actions:
        edit && amount !== null
          ? [action({ type: "UPDATE_BUDGET", label: "예산 변경하기", amount })]
          : [],
    };
  }

  // 8) Memo / journal.
  if (/기록|메모|일기|남겨|저장해/.test(text)) {
    const content = text.replace(/(기록|메모|일기)(해|해줘|남겨줘|해 줘)?\.?$/, "").trim() || text;
    return {
      message: "좋은 순간이네요. 여행 기록에 남겨 둘까요?",
      quickReplies: [],
      actions: edit ? [action({ type: "CREATE_JOURNAL", label: "기록 남기기", text: content.slice(0, 500), mood: /좋|최고|맛있|행복/.test(text) ? "HAPPY" : null })] : [],
    };
  }

  // 9) Default: where am I in the day?
  if (!ctx.focusDay || ctx.items.length === 0) {
    return {
      message: `아직 ${ctx.focusDay ? `Day ${ctx.focusDay.dayNumber}` : "이번 여행"} 일정이 비어 있어요. 일정 탭에서 AI 일정을 만들거나, 가고 싶은 곳을 말해 주세요.`,
      quickReplies: ["밥 먹을 곳 추천해줘", "비 오면 어떡하지?"],
      actions: [],
    };
  }
  const parts = [`${nowText(ctx)} 오늘 일정이 ${left.length}개 남아 있어요.`];
  if (current) parts.push(`지금은 ‘${current.title}’ 일정이에요.`);
  if (next) parts.push(`다음은 ${formatMinute(next.startMinute)} ‘${next.title}’${travelText(ctx, next.location) ? `, ${travelText(ctx, next.location)}` : ""}이에요.`);
  if (ctx.weather) parts.push(`날씨는 ${ctx.weather.condition}, 최고 ${ctx.weather.tempMax}°C예요.`);
  return {
    message: parts.join(" "),
    quickReplies: ["지금 너무 피곤해", "밥 먹고 어디 가지?", "1시간 더 있을래"],
    actions: [],
  };
}

function categoryLabel(key: string) {
  return { LODGING: "숙박", TRANSPORT: "교통", FOOD: "식비", SIGHTSEEING: "관광", SHOPPING: "쇼핑", OTHER: "기타" }[key] ?? key;
}
