import type { ExpenseCategory, Mood, PlaceCategory } from "@/generated/prisma/enums";

export interface TravelReportView {
  version: 1;
  generatedAt: string;
  trip: { title: string; destination: string; startDate: string; endDate: string; travelerCount: number };
  stats: {
    days: number;
    places: number;
    totalSpent: number;
    currency: string;
    perPerson: number;
    budget: number | null;
    byCategory: { category: ExpenseCategory; amount: number }[];
    photos: number;
    journalEntries: number;
  };
  highlights: {
    memorablePlace: string | null;
    favoriteFood: string | null;
    topCategory: { category: PlaceCategory; label: string; count: number } | null;
    moods: { mood: Mood; count: number }[];
    coverPhotoIds: string[];
  };
  ai: { title: string; retrospective: string; highlights: string[]; nextTripTip: string };
}
