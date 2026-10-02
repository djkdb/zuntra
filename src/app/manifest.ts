import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TripMate",
    short_name: "TripMate",
    description: "여행 전·여행 중·여행 후를 하나의 흐름으로 관리하는 AI 여행 동행",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#2b6b77",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
