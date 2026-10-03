"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/states/page-skeleton";

// The demo keeps its state in sessionStorage, so it renders only in the browser.
export const DemoLoader = dynamic(() => import("./demo-app").then((m) => m.DemoApp), {
  ssr: false,
  loading: () => <PageSkeleton rows={4} />,
});
