import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { createTrip, getTrip, listTrips } from "@/server/services/trip-service";

export async function GET() {
  return handleApi(async () => {
    const user = await requireApiUser();
    return listTrips(user.id);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { id } = await createTrip(user.id, await readJson(request));
    return getTrip(id, user.id);
  }, 201);
}
