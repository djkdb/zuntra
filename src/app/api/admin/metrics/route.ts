import { getAdminMetrics } from "@/server/admin/metrics";
import { AppError } from "@/server/errors";
import { handleApi, requireApiUser } from "@/server/http";

export async function GET(request: Request) {
  return handleApi(async () => {
    const user = await requireApiUser();
    if (user.role !== "ADMIN") throw new AppError("NOT_FOUND", "요청한 항목을 찾을 수 없어요.");
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 365);
    return getAdminMetrics(days);
  });
}
