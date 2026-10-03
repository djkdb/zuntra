import type { Mood } from "@/generated/prisma/enums";

export const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: "AMAZING", emoji: "🤩", label: "최고" },
  { value: "HAPPY", emoji: "😊", label: "행복" },
  { value: "CALM", emoji: "😌", label: "평온" },
  { value: "TIRED", emoji: "😮‍💨", label: "피곤" },
  { value: "SAD", emoji: "🥲", label: "아쉬움" },
];

export interface PhotoView {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
}

export interface JournalEntryView {
  id: string;
  content: string;
  mood: Mood | null;
  rating: number | null;
  date: string;
  dayNumber: number | null;
  place: { id: string; name: string; category: string } | null;
  photos: PhotoView[];
  createdAt: string;
  isMine: boolean;
}

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_ENTRY = 6;
