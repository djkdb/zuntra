"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { fieldErrors, formDataToObject, formValues, invalidFormMessage } from "@/lib/validation/common";
import { createTripSchema } from "@/lib/validation/trip";
import { requireUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { createTrip, deleteTrip, updateTrip } from "@/server/services/trip-service";

const ARRAY_KEYS = ["styles"];

export async function createTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createTripSchema.safeParse(formDataToObject(formData, ARRAY_KEYS));
  if (!parsed.success) {
    return { message: invalidFormMessage(fieldErrors(parsed.error)), fields: fieldErrors(parsed.error), values: formValues(formData) };
  }

  let tripId: string;
  try {
    ({ id: tripId } = await createTrip(user.id, parsed.data));
  } catch (error) {
    if (error instanceof AppError) return { message: error.message, fields: error.fields, values: formValues(formData) };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/trips/${tripId}?created=1`);
}

/** The edit form always submits every field, so an empty budget means "remove the budget". */
export async function updateTripAction(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createTripSchema.safeParse(formDataToObject(formData, ARRAY_KEYS));
  if (!parsed.success) {
    return { message: invalidFormMessage(fieldErrors(parsed.error)), fields: fieldErrors(parsed.error), values: formValues(formData) };
  }

  try {
    await updateTrip(tripId, user.id, {
      ...parsed.data,
      pace: parsed.data.pace ?? "",
      purpose: parsed.data.purpose ?? "",
      notes: parsed.data.notes ?? "",
      budgetAmount: parsed.data.budgetAmount ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) return { message: error.message, fields: error.fields, values: formValues(formData) };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/trips/${tripId}?updated=1`);
}

export async function deleteTripAction(tripId: string): Promise<FormState> {
  const user = await requireUser();
  try {
    await deleteTrip(tripId, user.id);
  } catch (error) {
    if (error instanceof AppError) return { message: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/trips?deleted=1");
}
