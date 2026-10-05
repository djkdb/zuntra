"use client";

import { CalendarDaysIcon } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { Field, FormMessage, useFocusFirstError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type FormState, initialFormState } from "@/lib/action-state";
import {
  CURRENCIES,
  MAX_TRAVELERS,
  MAX_TRIP_DAYS,
  TIME_ZONES,
  TRAVEL_PACES,
  TRAVEL_PACE_LABELS,
  TRAVEL_STYLES,
  TRAVEL_STYLE_LABELS,
} from "@/lib/constants";
import { diffDaysIso, formatShortDate, formatTripLength, isValidIsoDate } from "@/lib/dates";
import { guessTimeZone } from "@/lib/timezone-guess";

export interface TripFormDefaults {
  title?: string;
  destination?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  travelerCount?: number;
  styles?: string[];
  pace?: string | null;
  budgetAmount?: number | string | null;
  currency?: string;
  preferredPlaces?: string[];
  preferredFoods?: string[];
  purpose?: string | null;
  notes?: string | null;
}

interface TripFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: TripFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  /** Lets the edit form warn that removing days is refused when they still hold plans. */
  footnote?: React.ReactNode;
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function splitList(v: string | undefined) {
  return v?.split(",").map((s) => s.trim()).filter(Boolean);
}

export function TripForm({ action, defaults: initial, submitLabel, pendingLabel, footnote }: TripFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, state);
  const v = state.values;
  const defaults: TripFormDefaults = v
    ? {
        title: one(v.title),
        destination: one(v.destination),
        timezone: one(v.timezone),
        startDate: one(v.startDate),
        endDate: one(v.endDate),
        travelerCount: Number(one(v.travelerCount)) || undefined,
        styles: Array.isArray(v.styles) ? v.styles : v.styles ? [v.styles] : [],
        pace: one(v.pace),
        // Echo what was typed ("60만원"), never a parsed NaN.
        budgetAmount: one(v.budgetAmount) || null,
        currency: one(v.currency),
        preferredPlaces: splitList(one(v.preferredPlaces)),
        preferredFoods: splitList(one(v.preferredFoods)),
        purpose: one(v.purpose),
        notes: one(v.notes),
      }
    : initial;

  const [destination, setDestination] = useState(defaults.destination ?? "");
  const [timezone, setTimezone] = useState(defaults.timezone ?? "Asia/Seoul");
  const [timezoneTouched, setTimezoneTouched] = useState(Boolean(initial.timezone));
  const [startDate, setStartDate] = useState(defaults.startDate ?? "");
  const [endDate, setEndDate] = useState(defaults.endDate ?? "");
  const [title, setTitle] = useState(defaults.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(initial.title));
  const [travelers, setTravelers] = useState(String(defaults.travelerCount ?? 1));

  const datesValid = isValidIsoDate(startDate) && isValidIsoDate(endDate) && diffDaysIso(startDate, endDate) >= 0;
  const lengthLabel = datesValid ? formatTripLength(startDate, endDate) : null;
  const suggestedTitle = destination.trim() ? `${destination.trim()}${lengthLabel ? ` ${lengthLabel}` : " 여행"}` : "";

  const onDestinationChange = (value: string) => {
    setDestination(value);
    if (!timezoneTouched) {
      const guess = guessTimeZone(value);
      if (guess) setTimezone(guess);
    }
  };

  const timezoneOptions = TIME_ZONES.some((z) => z.id === timezone)
    ? TIME_ZONES
    : [...TIME_ZONES, { id: timezone, label: timezone }];

  return (
    <form
      ref={formRef}
      action={formAction}
      // Submitting through a transition keeps every field as typed on a validation error;
      // the default form action would reset the form (the time zone select lost its value).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] xl:gap-12" noValidate>
      <div className="min-w-0 space-y-8">
        <FormMessage message={state.message} />

        <section aria-labelledby="trip-basic" className="space-y-5">
          <h2 id="trip-basic" className="text-base font-semibold">
            어디로 떠나나요?
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="여행지" error={state.fields?.destination}>
              {(props) => (
                <Input
                  {...props}
                  name="destination"
                  value={destination}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  placeholder="예: 다낭, 파리, 제주"
                  maxLength={80}
                  autoComplete="off"
                  required
                />
              )}
            </Field>
            <Field
              label="여행 이름"
              error={state.fields?.title}
              hint={!titleTouched && suggestedTitle ? "여행지와 날짜로 자동으로 만들었어요. 바꿔도 돼요." : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  name="title"
                  value={titleTouched ? title : suggestedTitle}
                  onChange={(e) => {
                    setTitleTouched(true);
                    setTitle(e.target.value);
                  }}
                  placeholder="예: 여름휴가 3박 4일"
                  maxLength={60}
                  required
                />
              )}
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="출발일" error={state.fields?.startDate}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  required
                />
              )}
            </Field>
            <Field
              label="귀국일"
              error={state.fields?.endDate}
              hint={lengthLabel ? <span className="font-medium text-foreground">{lengthLabel}</span> : `최대 ${MAX_TRIP_DAYS}일`}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  name="endDate"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label="동행 인원" error={state.fields?.travelerCount} hint="나를 포함한 인원">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  name="travelerCount"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TRAVELERS}
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label="현지 시간대" error={state.fields?.timezone} hint="여행 중 '지금'을 계산할 때 써요.">
              {(props) => (
                <NativeSelect
                  {...props}
                  name="timezone"
                  value={timezone}
                  onChange={(e) => {
                    setTimezoneTouched(true);
                    setTimezone(e.target.value);
                  }}
                >
                  {timezoneOptions.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
        </section>

        <section aria-labelledby="trip-taste" className="space-y-5 border-t pt-7">
          <div>
            <h2 id="trip-taste" className="text-base font-semibold">
              이번 여행의 취향
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">여행 프로필에서 가져왔어요. 이번 여행에 맞게 바꿔 주세요.</p>
          </div>
          <ChoiceGroup
            legend="여행 스타일"
            name="styles"
            type="checkbox"
            optional
            options={TRAVEL_STYLES.map((s) => ({ value: s, label: TRAVEL_STYLE_LABELS[s] }))}
            defaultValue={defaults.styles}
            error={state.fields?.styles}
          />
          <ChoiceGroup
            legend="여행 속도"
            name="pace"
            type="radio"
            variant="cards"
            optional
            options={TRAVEL_PACES.map((p) => ({ value: p, ...TRAVEL_PACE_LABELS[p] }))}
            defaultValue={defaults.pace ?? undefined}
            error={state.fields?.pace}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="가고 싶은 곳" optional error={state.fields?.preferredPlaces} hint="쉼표로 구분 (예: 야시장, 해변)">
              {(props) => <Input {...props} name="preferredPlaces" defaultValue={defaults.preferredPlaces?.join(", ") ?? ""} />}
            </Field>
            <Field label="먹고 싶은 음식" optional error={state.fields?.preferredFoods} hint="쉼표로 구분 (예: 현지 국수, 해산물)">
              {(props) => <Input {...props} name="preferredFoods" defaultValue={defaults.preferredFoods?.join(", ") ?? ""} />}
            </Field>
          </div>
        </section>

        <section aria-labelledby="trip-budget" className="space-y-5 border-t pt-7">
          <h2 id="trip-budget" className="text-base font-semibold">
            예산과 메모
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-x-3 gap-y-5 xl:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.4fr)] xl:gap-x-5">
            <Field label="총 예산" optional error={state.fields?.budgetAmount}>
              {(props) => (
                <Input
                  {...props}
                  name="budgetAmount"
                  inputMode="decimal"
                  placeholder="예: 1500000 또는 150만"
                  defaultValue={defaults.budgetAmount ?? ""}
                />
              )}
            </Field>
            <Field label="통화" error={state.fields?.currency}>
              {(props) => (
                <NativeSelect {...props} name="currency" defaultValue={defaults.currency ?? "KRW"}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="여행 목적" optional error={state.fields?.purpose} className="col-span-2 xl:col-span-1">
              {(props) => (
                <Input
                  {...props}
                  name="purpose"
                  maxLength={200}
                  placeholder="예: 친구와 첫 해외여행, 먹방 여행"
                  defaultValue={defaults.purpose ?? ""}
                />
              )}
            </Field>
          </div>
          <Field label="추가 메모" optional error={state.fields?.notes} hint="AI가 일정을 만들 때 참고해요.">
            {(props) => (
              <Textarea
                {...props}
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="예: 너무 빡빡한 일정은 싫어요. 저녁엔 현지 술집에 가 보고 싶어요."
                defaultValue={defaults.notes ?? ""}
              />
            )}
          </Field>
        </section>

        <div className="sticky bottom-20 z-10 -mx-4 flex items-center gap-3 border-t bg-background/90 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 lg:hidden">
          <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel={pendingLabel} pending={isPending}>
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            {submitLabel}
          </SubmitButton>
          {footnote}
        </div>
      </div>

      {/* Desktop: a live summary of the trip being created, with the action always in view. */}
      <aside aria-labelledby="trip-summary" className="sticky top-7 hidden rounded-lg border bg-card p-4 lg:block">
        <h2 id="trip-summary" className="text-sm font-semibold">
          만들 여행
        </h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <SummaryRow label="여행지" value={destination.trim() || null} />
          <SummaryRow
            label="일정"
            value={datesValid ? `${formatShortDate(startDate)} – ${formatShortDate(endDate)}, ${lengthLabel}` : null}
          />
          <SummaryRow label="인원" value={Number(travelers) > 0 ? `${travelers}명` : null} />
          <SummaryRow label="시간대" value={timezoneOptions.find((z) => z.id === timezone)?.label ?? timezone} />
        </dl>
        <SubmitButton className="mt-4 w-full" pendingLabel={pendingLabel} pending={isPending}>
          <CalendarDaysIcon data-icon="inline-start" aria-hidden />
          {submitLabel}
        </SubmitButton>
        {footnote ? <div className="mt-3 text-xs">{footnote}</div> : null}
      </aside>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "font-medium break-words" : "text-muted-foreground"}>{value ?? "입력 전"}</dd>
    </div>
  );
}
