import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#2b6b77",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path
            d="M9 21.5c3.2-1.1 5.4-3.7 6.6-7.7.4-1.4 2.3-1.5 2.9-.2l3.5 7.9"
            fill="none"
            stroke="#fbfaf7"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="10.5" r="2.4" fill="#e0905f" />
        </svg>
      </div>
    ),
    size,
  );
}
