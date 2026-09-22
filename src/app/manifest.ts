import type { MetadataRoute } from "next";
import { m } from "@/lib/messages";

// Lets a phone browser install the app to the home screen. Icons are generated (see
// icon-192.png/, icon-512.png/, icon-512-maskable.png/) rather than drawn, since there is no
// real branding yet — a placeholder Elie can replace with a proper logo any time (see DEBT-036).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.app.name,
    short_name: m.app.name,
    description: m.app.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
