"use client";

import { useActionState, useRef } from "react";
import { completeOnboardingAction } from "@/app/profile-actions";
import { FormMessage, useFocusFirstError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/action-state";
import { TravelProfileFields, type TravelProfileDefaults, profileDefaultsFrom } from "./travel-profile-fields";

export function OnboardingForm({ defaults, next }: { defaults: TravelProfileDefaults; next?: string }) {
  const [state, action] = useActionState(completeOnboardingAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, state);
  return (
    <form ref={formRef} action={action} className="space-y-9" noValidate>
      <FormMessage message={state.message} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TravelProfileFields defaults={profileDefaultsFrom(state.values, defaults)} errors={state.fields} />
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="저장 중…">
        여행 프로필 저장하고 시작하기
      </SubmitButton>
    </form>
  );
}
