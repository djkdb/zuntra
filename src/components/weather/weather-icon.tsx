import { CloudDrizzleIcon, CloudFogIcon, CloudIcon, CloudLightningIcon, CloudRainIcon, CloudSnowIcon, CloudSunIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  clear: SunIcon,
  partly_cloudy: CloudSunIcon,
  cloudy: CloudIcon,
  fog: CloudFogIcon,
  drizzle: CloudDrizzleIcon,
  rain: CloudRainIcon,
  snow: CloudSnowIcon,
  storm: CloudLightningIcon,
} as const;

export function WeatherIcon({ condition, className }: { condition: string; className?: string }) {
  const Icon = ICONS[condition as keyof typeof ICONS] ?? CloudIcon;
  return <Icon aria-hidden className={cn(condition === "clear" ? "text-sunset" : "text-primary", className)} />;
}
