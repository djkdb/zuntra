import { errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";

/** Unknown API paths answer in the API's JSON error shape instead of the HTML 404 page. */
function notFound() {
  return errorResponse(new AppError("NOT_FOUND", "존재하지 않는 API 경로예요."));
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
