import "server-only";
import type { BudgetLevel, TravelPace, TravelStyle } from "@/generated/prisma/enums";

export interface FixedSlot {
  title: string;
  category: string;
  start: number;
  end: number;
}

/** Everything the planner (model or mock) may know. Built server-side from the user's own data. */
export interface PlannerContext {
  destination: string;
  timezone: string;
  currency: string;
  travelerCount: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  days: {
    dayNumber: number;
    date: string;
    rainy: boolean;
    isFirst: boolean;
    isLast: boolean;
    /** The traveller's own name for the day, often its city. */
    hint?: string | null;
    /** Booked times already on the day (flights, reservations); plan around them. */
    fixed?: FixedSlot[];
  }[];
  styles: TravelStyle[];
  pace: TravelPace;
  budgetLevel: BudgetLevel;
  budgetAmount: number | null;
  preferredPlaces: string[];
  preferredFoods: string[];
  purpose: string | null;
  notes: string | null;
  request: string | null;
  center: { lat: number; lng: number } | null;
  /** Titles already on the itinerary (other days), to avoid duplicates. */
  existing: string[];
}
