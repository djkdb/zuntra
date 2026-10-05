"use client";

import { CalendarIcon, DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Take the trip out of the app: calendar file for the itinerary, spreadsheets for both. */
export function ExportMenu({ tripId }: { tripId: string }) {
  const base = `/api/trips/${tripId}/export`;
  const items = [
    { href: `${base}?format=ics`, label: "캘린더에 추가 (.ics)", hint: "구글·애플 캘린더", icon: CalendarIcon },
    { href: `${base}?format=csv&what=itinerary`, label: "일정 표 (.csv)", hint: "엑셀·구글 시트", icon: FileSpreadsheetIcon },
    { href: `${base}?format=csv&what=expenses`, label: "경비 내역 (.csv)", hint: "정산용", icon: FileSpreadsheetIcon },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground max-sm:size-9 max-sm:px-0">
          <DownloadIcon data-icon="inline-start" aria-hidden />
          <span className="max-sm:sr-only">내보내기</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>내보내기</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <a href={item.href} download>
              <item.icon aria-hidden />
              <span className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
