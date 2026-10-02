import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "TripMate — 여행을 계획하는 게 아니라, 여행을 함께 준비하세요.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered once at build time. Satori needs a font with Hangul glyphs (woff, not woff2).
export default async function OpengraphImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/og/Pretendard-Bold.subset.woff")),
    readFile(join(process.cwd(), "assets/og/Pretendard-Regular.subset.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1f5560 0%, #2b6b77 55%, #d98a5b 140%)",
          color: "#fbfaf7",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#fbfaf7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#e0905f" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>TripMate</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.2, display: "flex", flexDirection: "column" }}>
            <span>여행을 계획하는 게 아니라,</span>
            <span>여행을 함께 준비하세요.</span>
          </div>
          <div style={{ fontSize: 30, opacity: 0.85 }}>
            일정 · 이동 · 날씨 · 예산 · 여행 중 변수까지, AI 여행 동행
          </div>
        </div>
        <div style={{ fontSize: 22, letterSpacing: 4, opacity: 0.7 }}>PLAN · PREPARE · TRAVEL · ADAPT · REMEMBER</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
