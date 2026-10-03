import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { QueryProvider } from "@/components/query-provider";
import { todayInTimeZone } from "@/lib/dates";
import { phaseOf, pickFocusTrip } from "@/lib/trips";
import { requireOnboardedUser } from "@/server/auth/session";
import { listTripsForRequest } from "@/server/services/trip-queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireOnboardedUser();
  const trips = await listTripsForRequest(user.id);
  const focus = pickFocusTrip(trips);

  return (
    <QueryProvider userId={user.id}>
      <div className="flex min-h-dvh">
        <AppSidebar
          user={{ name: user.name, email: user.email }}
          focusTrip={
            focus
              ? {
                  id: focus.id,
                  title: focus.title,
                  destination: focus.destination,
                  startDate: focus.startDate,
                  phase: phaseOf(focus),
                  today: todayInTimeZone(focus.timezone),
                }
              : null
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader user={{ name: user.name, email: user.email }} />
          <main
            id="main"
            className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
          >
            {children}
          </main>
        </div>
        <BottomNav focusTripId={focus?.id ?? null} />
      </div>
    </QueryProvider>
  );
}
