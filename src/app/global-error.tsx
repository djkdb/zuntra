"use client";

/** Last-resort boundary (root layout failed), so it renders its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>문제가 발생했어요</h1>
          <p style={{ color: "#666" }}>잠시 후 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, border: "1px solid #ccc", background: "#fff" }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
