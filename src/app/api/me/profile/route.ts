import { travelProfileSchema } from "@/lib/validation/profile";
import { fieldErrors } from "@/lib/validation/common";
import { AppError } from "@/server/errors";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { getTravelProfile, saveTravelProfile } from "@/server/services/user-service";

export async function GET() {
  return handleApi(async () => {
    const user = await requireApiUser();
    const profile = await getTravelProfile(user.id);
    return { name: user.name, email: user.email, profile };
  });
}

export async function PUT(request: Request) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const parsed = travelProfileSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("VALIDATION", "입력값을 확인해 주세요.", fieldErrors(parsed.error));
    return saveTravelProfile(user.id, parsed.data);
  });
}
