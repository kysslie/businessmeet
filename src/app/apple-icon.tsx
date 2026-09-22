import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS's "Add to Home Screen" icon. No safe-zone padding needed here (iOS applies its own
// rounded-square mask uniformly, unlike Android's maskable icons). Same placeholder mark.
export default function AppleIcon() {
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
          fontSize: 80,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        BM
      </div>
    ),
    size,
  );
}
