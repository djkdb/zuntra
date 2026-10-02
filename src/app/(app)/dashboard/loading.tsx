// Loading boundaries live in leaf segments (not the (app) group) so access checks in layouts
// finish before streaming starts — that keeps real 404 status codes for inaccessible trips.
import { PageSkeleton } from "@/components/states/page-skeleton";

export default function Loading() {
  return <PageSkeleton />;
}
