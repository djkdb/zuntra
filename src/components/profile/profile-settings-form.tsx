"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/profile-actions";
import { FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/action-state";
import { TravelProfileFields, type TravelProfileDefaults, profileDefaultsFrom } from "./travel-profile-fields";

export function ProfileSettingsForm({ defaults }: { defaults: TravelProfileDefaults }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="space-y-9" noValidate>
      <FormMessage message={state.message} tone={state.ok ? "success" : "error"} />
      <TravelProfileFields defaults={profileDefaultsFrom(state.values, defaults)} errors={state.fields} />
      <SubmitButton pendingLabel="저장 중…">프로필 저장</SubmitButton>
    </form>
  );
}
