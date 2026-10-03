import { handleApi, requireApiUser } from "@/server/http";
import { getTripWeather } from "@/server/services/weather-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/weather">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getTripWeather(tripId, user.id);
  });
}
