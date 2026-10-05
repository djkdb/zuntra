import { ChoiceGroup } from "@/components/forms/choice-group";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import {
  BUDGET_LEVELS,
  BUDGET_LEVEL_LABELS,
  COMPANION_TYPES,
  COMPANION_TYPE_LABELS,
  TRAVEL_PACES,
  TRAVEL_PACE_LABELS,
  TRAVEL_STYLES,
  TRAVEL_STYLE_LABELS,
} from "@/lib/constants";

export interface TravelProfileDefaults {
  name?: string | null;
  styles?: string[];
  pace?: string;
  budgetLevel?: string;
  favoriteFoods?: string[];
  companionType?: string;
}

/** Shared by onboarding and settings so both edit the exact same Travel Profile. */
export function TravelProfileFields({
  defaults,
  errors,
}: {
  defaults?: TravelProfileDefaults;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-9">
      <Field label="이름" error={errors?.name}>
        {(props) => (
          <Input {...props} name="name" defaultValue={defaults?.name ?? ""} autoComplete="name" maxLength={40} />
        )}
      </Field>

      <ChoiceGroup
        legend="어떤 여행을 좋아하세요?"
        hint="여러 개 고를 수 있어요."
        name="styles"
        type="checkbox"
        options={TRAVEL_STYLES.map((v) => ({ value: v, label: TRAVEL_STYLE_LABELS[v] }))}
        defaultValue={defaults?.styles}
        error={errors?.styles}
      />

      <ChoiceGroup
        legend="여행 속도"
        name="pace"
        type="radio"
        variant="cards"
        options={TRAVEL_PACES.map((v) => ({ value: v, ...TRAVEL_PACE_LABELS[v] }))}
        defaultValue={defaults?.pace ?? "MODERATE"}
        error={errors?.pace}
      />

      <ChoiceGroup
        legend="예산 수준"
        name="budgetLevel"
        type="radio"
        variant="cards"
        options={BUDGET_LEVELS.map((v) => ({ value: v, ...BUDGET_LEVEL_LABELS[v] }))}
        defaultValue={defaults?.budgetLevel ?? "STANDARD"}
        error={errors?.budgetLevel}
      />

      <Field
        label="좋아하는 음식"
        optional
        error={errors?.favoriteFoods}
        hint="쉼표로 구분해 주세요. 예: 라멘, 스시, 디저트"
      >
        {(props) => (
          <Input
            {...props}
            name="favoriteFoods"
            defaultValue={defaults?.favoriteFoods?.join(", ") ?? ""}
            placeholder="예: 해산물, 국수, 디저트"
          />
        )}
      </Field>

      <ChoiceGroup
        legend="주로 누구와 여행하나요?"
        name="companionType"
        type="radio"
        options={COMPANION_TYPES.map((v) => ({ value: v, label: COMPANION_TYPE_LABELS[v] }))}
        defaultValue={defaults?.companionType ?? "SOLO"}
        error={errors?.companionType}
      />
    </div>
  );
}

/** Builds field defaults from an action's echoed values, falling back to the stored profile. */
export function profileDefaultsFrom(
  values: Record<string, string | string[]> | undefined,
  fallback: TravelProfileDefaults,
): TravelProfileDefaults {
  if (!values) return fallback;
  const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    name: one(values.name) ?? "",
    styles: list(values.styles),
    pace: one(values.pace),
    budgetLevel: one(values.budgetLevel),
    favoriteFoods: one(values.favoriteFoods)?.split(",").map((s) => s.trim()).filter(Boolean),
    companionType: one(values.companionType),
  };
}
