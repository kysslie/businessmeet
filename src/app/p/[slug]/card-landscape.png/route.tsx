import { ImageResponse } from "next/og";
import { m } from "@/lib/messages";
import { loadShareCardData } from "@/lib/share-card-data";
import { fallbackCard, landscapeCard } from "@/lib/share-card-view";

const size = { width: 1200, height: 630 };

// "Télécharger ma carte" (P3b), landscape format. Same content as opengraph-image, as an
// explicit downloadable file rather than an auto-embedded preview.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadShareCardData(slug);
  return new ImageResponse(data ? landscapeCard(data, m.app.name) : fallbackCard(size.width, size.height, m.app.name), {
    ...size,
    headers: { "Content-Disposition": `attachment; filename="${slug}-businessmeet.png"` },
  });
}
