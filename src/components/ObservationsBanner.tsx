import type { Observation, ObservationsResult } from "@/lib/observations";

const COLORS = {
  declineFg: "#dc2626",
  declineBg: "#fef2f2",
  declineBorder: "#fecaca",
  growthFg: "#16a34a",
  growthBg: "#f0fdf4",
  growthBorder: "#bbf7d0",
  neutralFg: "#6b7280",
  neutralBg: "#f9fafb",
  neutralBorder: "#e5e7eb",
  glimmerFg: "#7c3aed",
  glimmerBg: "#faf5ff",
  glimmerBorder: "#e9d5ff",
};

function colorsFor(o: Observation) {
  switch (o.kind) {
    case "decline": return { fg: COLORS.declineFg, bg: COLORS.declineBg, border: COLORS.declineBorder };
    case "growth": return { fg: COLORS.growthFg, bg: COLORS.growthBg, border: COLORS.growthBorder };
    case "glimmer": return { fg: COLORS.glimmerFg, bg: COLORS.glimmerBg, border: COLORS.glimmerBorder };
    default: return { fg: COLORS.neutralFg, bg: COLORS.neutralBg, border: COLORS.neutralBorder };
  }
}

function arrowFor(o: Observation): string {
  if (o.deltaAbs > 0) return "↑";
  if (o.deltaAbs < 0) return "↓";
  return "—";
}

function HeadlineRow({ o }: { o: Observation }) {
  const c = colorsFor(o);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px",
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6,
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: c.fg, width: 18, textAlign: "center" }}>
        {arrowFor(o)}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#23263B", flex: 1 }}>
        {o.headline}
      </span>
      <span style={{ fontSize: 13, color: "#6b7280", fontFamily: "'Geist Mono', monospace" }}>
        {o.detail}
      </span>
    </div>
  );
}

export default function ObservationsBanner({ result }: { result: ObservationsResult }) {
  const { framing, headlines, glimmers, concerns } = result;
  if (!framing) return null;

  const hasGlimmers = glimmers.length > 0;

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Period header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 4px", marginBottom: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#484C7A", textTransform: "uppercase", letterSpacing: 1.2 }}>
          Observations · MoM
        </div>
        <div style={{ fontSize: 12, color: framing.inProgress ? "#d97706" : "#7778AF", fontWeight: framing.inProgress ? 600 : 400 }}>
          {framing.label}
        </div>
      </div>

      {/* Two-column layout: headlines+concerns on left, glimmers on right */}
      <div style={{
        display: "grid",
        gridTemplateColumns: hasGlimmers ? "1fr 1fr" : "1fr",
        gap: 12,
        alignItems: "start",
      }}>
        <div>
          {headlines.map((o) => <HeadlineRow key={o.metric} o={o} />)}
          {concerns.map((o, i) => <HeadlineRow key={`concern-${i}`} o={o} />)}
        </div>

        {hasGlimmers && (
          <div style={{
            padding: "12px 14px",
            background: COLORS.glimmerBg,
            border: `1px solid ${COLORS.glimmerBorder}`,
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.glimmerFg, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              ✦ Glimmers
            </div>
            {glimmers.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: i === glimmers.length - 1 ? 0 : 8 }}>
                <span style={{ fontSize: 14, color: COLORS.glimmerFg }}>•</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#23263B" }}>{g.headline}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{g.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
