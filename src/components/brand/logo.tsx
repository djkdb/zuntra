import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M9 21.5c3.2-1.1 5.4-3.7 6.6-7.7.4-1.4 2.3-1.5 2.9-.2l3.5 7.9"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <circle cx="22" cy="10.5" r="2.4" className="fill-sunset" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className="size-7" />
      <span className="text-lg">TripMate</span>
    </span>
  );
}
