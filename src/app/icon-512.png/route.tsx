import { ImageResponse } from "next/og";

// Placeholder app icon (no real branding yet, see DEBT-036). Referenced by manifest.ts.
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
          color: "#ffffff",
          fontSize: 224,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        BM
      </div>
    ),
    { width: 512, height: 512 },
  );
}
