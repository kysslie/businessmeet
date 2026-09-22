import { ImageResponse } from "next/og";

// Maskable variant (Android adaptive icons): the background fills the whole canvas, and the
// mark is kept inside the safe zone (roughly the inner 80%) so OS-applied shape masks never
// clip it. Placeholder, no real branding yet (see DEBT-036).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "80%",
            height: "80%",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 180,
            fontWeight: 700,
            fontFamily: "sans-serif",
          }}
        >
          BM
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
