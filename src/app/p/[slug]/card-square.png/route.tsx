import { ImageResponse } from "next/og";
import { m } from "@/lib/messages";
import { loadShareCardData } from "@/lib/share-card-data";
import { fallbackCard, squareCard } from "@/lib/share-card-view";

const size = { width: 1080, height: 1080 };

// "Télécharger ma carte" (P3b), square format.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadShareCardData(slug);
  return new ImageResponse(data ? squareCard(data, m.app.name) : fallbackCard(size.width, size.height, m.app.name), {
    ...size,
    headers: { "Content-Disposition": `attachment; filename="${slug}-businessmeet-carre.png"` },
  });
}
