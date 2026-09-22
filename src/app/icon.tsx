import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Modern favicon (evergreen browsers use this over favicon.ico). Same placeholder mark.
export default function Icon() {
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
          fontSize: 18,
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
