import type { ShareCardData } from "@/lib/share-card-data";

// Shared look for every share card (P3b): the Open Graph image and both downloadable formats.
// ImageResponse (Satori) only understands a small subset of CSS, so these stay to flexbox.
const DARK = "#171717";
const LIGHT = "#ffffff";
const MUTED = "#a1a1aa";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        border: `2px solid ${LIGHT}`,
        borderRadius: 999,
        padding: "10px 24px",
        fontSize: 28,
        color: LIGHT,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ count, label }: { count: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: LIGHT }}>{count}</div>
      <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{label}</div>
    </div>
  );
}

export function landscapeCard(data: ShareCardData, appName: string) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: DARK,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: LIGHT }}>{data.displayName}</div>
        {data.place && <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{data.place}</div>}
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {data.categoryName && <Badge>{data.categoryName}</Badge>}
          {data.openToPartners && <Badge>Ouvert aux associés</Badge>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 48 }}>
          <Stat count={data.projectCount} label={data.projectCount === 1 ? "projet" : "projets"} />
          {data.outcomeCounts.map((oc) => (
            <Stat key={oc.label} count={oc.count} label={oc.label} />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>{appName}</div>
      </div>
    </div>
  );
}

export function squareCard(data: ShareCardData, appName: string) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: DARK,
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: LIGHT }}>{data.displayName}</div>
        {data.place && <div style={{ display: "flex", fontSize: 34, color: MUTED }}>{data.place}</div>}
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {data.categoryName && <Badge>{data.categoryName}</Badge>}
          {data.openToPartners && <Badge>Ouvert aux associés</Badge>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 56, marginTop: 72 }}>
        <Stat count={data.projectCount} label={data.projectCount === 1 ? "projet" : "projets"} />
        {data.outcomeCounts.map((oc) => (
          <Stat key={oc.label} count={oc.count} label={oc.label} />
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 72 }}>{appName}</div>
    </div>
  );
}

export function fallbackCard(width: number, height: number, appName: string) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: DARK,
        color: LIGHT,
        fontSize: 56,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      {appName}
    </div>
  );
}
