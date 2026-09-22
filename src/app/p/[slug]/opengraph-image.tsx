import { ImageResponse } from "next/og";
import { m } from "@/lib/messages";
import { loadShareCardData } from "@/lib/share-card-data";
import { fallbackCard, landscapeCard } from "@/lib/share-card-view";

export const alt = "BusinessMeet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The image chat apps show when a /p/[slug] link is pasted (P3b). Fetched by link-preview
// bots, which have no session -- same as any other logged-out visitor -- so this only ever
// shows what a stranger could already see (loadShareCardData reuses the same public functions
// the portfolio page itself uses).
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadShareCardData(slug);
  return new ImageResponse(data ? landscapeCard(data, m.app.name) : fallbackCard(size.width, size.height, m.app.name), size);
}
