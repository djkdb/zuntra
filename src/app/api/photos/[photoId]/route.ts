import { errorResponse, requireApiUser } from "@/server/http";
import { readPhoto } from "@/server/services/journal-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[photoId]">) {
  try {
    const user = await requireApiUser();
    const { photoId } = await ctx.params;
    const photo = await readPhoto(photoId, user.id);
    return new Response(Buffer.from(photo.body), {
      headers: {
        "content-type": photo.contentType,
        // Private: browsers may cache, shared caches/CDNs must not.
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
