"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "라이트", icon: SunIcon },
  { value: "dark", label: "다크", icon: MoonIcon },
  { value: "system", label: "시스템", icon: MonitorIcon },
] as const;

const subscribe = () => () => {};

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; render neutral on the server.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div role="radiogroup" aria-label="화면 테마" className="inline-flex rounded-xl border bg-card p-1">
      {OPTIONS.map((o) => {
        const checked = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors",
              checked && "bg-secondary font-medium text-secondary-foreground",
            )}
          >
            <o.icon className="size-4" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
