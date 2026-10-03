import { MAX_PHOTO_BYTES } from "@/lib/journal";
import { AppError } from "@/server/errors";
import { guardWrite, handleApi, requireApiUser } from "@/server/http";
import { uploadPhoto } from "@/server/services/journal-service";

/** multipart/form-data: file (image), width?, height?, caption? */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/photos">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_PHOTO_BYTES + 64 * 1024) throw new AppError("VALIDATION", "사진은 8MB 이하만 올릴 수 있어요.");
    const { tripId } = await ctx.params;
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError("VALIDATION", "사진 업로드 형식이 올바르지 않아요.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "사진 파일을 선택해 주세요.");
    const num = (k: string) => {
      const n = Number(form.get(k));
      return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
    };
    return uploadPhoto(tripId, user.id, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      width: num("width"),
      height: num("height"),
      caption: typeof form.get("caption") === "string" ? String(form.get("caption")) : null,
    });
  }, 201);
}
