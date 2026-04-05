export default function RDBrief() {
  const badge = (status: "MISSING" | "PARTIAL" | "PROPOSED") => {
    const colors: Record<string, { bg: string; color: string }> = {
      MISSING: { bg: "#dc2626", color: "#fff" },
      PARTIAL: { bg: "#d97706", color: "#fff" },
      PROPOSED: { bg: "#16a34a", color: "#fff" },
    };
    const c = colors[status];
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 5,
          letterSpacing: 0.5,
          background: c.bg,
          color: c.color,
        }}
      >
        {status}
      </span>
    );
  };

  const sectionTitle = (text: string) => (
    <div className="sec-t">{text}</div>
  );

  const codeBlock = (json: string) => (
    <pre
      style={{
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: 5,
        padding: 16,
        fontSize: 13,
        fontFamily: "'Sora', monospace",
        lineHeight: 1.6,
        overflowX: "auto",
        whiteSpace: "pre",
        color: "#23263B",
      }}
    >
      {json}
    </pre>
  );

  const endpointBlock = (
    method: string,
    path: string,
    description: string,
    params: string[],
    response: string
  ) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span
          style={{
            background: "#003DFF",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          {method}
        </span>
        <span
          style={{
            fontFamily: "'Sora', monospace",
            fontSize: 14,
            fontWeight: 600,
            color: "#000033",
            letterSpacing: 0.3,
          }}
        >
          {path}
        </span>
      </div>
      <p style={{ fontSize: 14, color: "#484C7A", marginBottom: 10 }}>{description}</p>
      {params.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9698C3", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>
            Parameters
          </div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {params.map((p, i) => (
              <li key={i} style={{ fontSize: 13, color: "#36395A", marginBottom: 3 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#9698C3", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>
        Example Response
      </div>
      {codeBlock(response)}
    </div>
  );

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          HERO CARD: PROBLEM + ASK
          One glance = know what this is about and what we need
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        <div
          style={{
            background: "linear-gradient(135deg, #f8f9fb 0%, #eef0ff 100%)",
            border: "2px solid #003DFF30",
            borderRadius: 8,
            padding: "32px 32px 28px",
            boxShadow: "0 4px 24px rgba(0, 61, 255, 0.08), 0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* ── THE PROBLEM ── */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003DFF", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 14 }}>
            The Problem
          </div>
          <p style={{ fontSize: 20, fontWeight: 600, color: "#000033", lineHeight: 1.4, marginBottom: 12, letterSpacing: -0.3 }}>
            Algolia&apos;s usage APIs report per application. There is no aggregated view for parent-child architectures.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 0 }}>
            Any Algolia customer running multiple child apps under a single parent account &mdash; OEM partners,
            agencies, marketplace integrations, multi-tenant platforms &mdash; has no API to answer basic questions:
            how many total records across all apps, which apps are active vs unused, what&apos;s the production vs
            staging split. Today the only path to this data is a manual CSV export from Hex, repeated every week.
          </p>

          {/* ── DIVIDER ── */}
          <div style={{ height: 1, background: "#003DFF20", margin: "24px 0" }} />

          {/* ── THE ASK ── */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003DFF", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 14 }}>
            The Ask
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#000033", lineHeight: 1.4, marginBottom: 16, letterSpacing: -0.3 }}>
            Build a parent-level usage aggregation API.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            Four read-only endpoints that expose aggregated usage data across all child applications
            under a parent account. The data already exists in the billing system and application registry &mdash;
            these endpoints surface it through the API. The proposed schemas and example responses are detailed below.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          WHY — THE BUSINESS CASE
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        {sectionTitle("Why This Matters")}
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 32px" }}>
            {[
              ["No self-service for partners", "OEM partners like Adobe cannot see their own usage without asking us. Every week, a team member pulls a CSV manually and sends it. This doesn't scale."],
              ["Billing data exists, API doesn't", "The billing system already aggregates at the parent level to generate invoices. Hex queries the same Redshift tables. This is an exposure problem, not a data problem."],
              ["Renewal risk without visibility", "Partners making multi-year commitment decisions need real-time usage data. Manual weekly CSVs with a 7-day lag don't support strategic conversations."],
              ["Not just OEM — any multi-app customer", "Any customer with a parent-child architecture has this gap. Agencies managing client apps, platforms with marketplace integrations, companies running prod + staging environments."],
            ].map(([title, desc], i) => (
              <div key={i}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          WHO BENEFITS
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        {sectionTitle("Who Benefits")}
        <div className="flex">
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              OEM Partners
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Adobe today, every future OEM partner tomorrow. Self-service usage visibility
              instead of waiting on manual CSV exports.
            </p>
          </div>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              Multi-App Customers
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Agencies, platforms, and any customer running multiple child apps under
              one parent. Same parent-child pattern, same need for aggregated data.
            </p>
          </div>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              Algolia Internal Teams
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Partnerships, CSMs, and account teams get automated reporting. No more
              manual Hex exports. Faster QBRs, proactive quota alerts.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          WHAT'S MISSING — API GAP TABLE
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        {sectionTitle("Current API Gap")}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Question a partner asks</th>
                <th>Current API answer</th>
                <th>Status</th>
                <th>Proposed endpoint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>How many total records across all my apps?</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage</td>
              </tr>
              <tr>
                <td>Show me all my child apps and their status</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/children</td>
              </tr>
              <tr>
                <td>What are the top queries across my portfolio?</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/analytics/top-queries</td>
              </tr>
              <tr>
                <td>How much is production vs staging?</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/engagement/summary</td>
              </tr>
              <tr>
                <td>Where am I against my quota?</td>
                <td style={{ color: "#7778AF" }}>Billing system only</td>
                <td>{badge("PARTIAL")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage</td>
              </tr>
              <tr>
                <td>Show me usage trends over time</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage?granularity=monthly</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PROPOSED API — 4 ENDPOINTS
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        {sectionTitle("Proposed API — 4 Endpoints")}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/usage",
          "Aggregated records, searches, and app count across all child applications. Includes quota utilization and historical trend.",
          [
            "parentId (path) — Parent application ID",
            "granularity (query, optional) — \"daily\" | \"weekly\" | \"monthly\"",
          ],
          `{
  "parentId": "EKVXKN7L76",
  "totalApps": 1485,
  "totalRecords": 39287022,
  "totalSearches": 15760140,
  "quotas": {
    "apps": { "used": 1485, "limit": 1500, "pct": 99.0 },
    "records": { "used": 39287022, "limit": 50000000, "pct": 78.6 },
    "searches": { "used": 15760140, "limit": 75000000, "pct": 21.0 }
  },
  "trend": [
    { "month": "2026-01", "apps": 1227, "records": 33172836 },
    { "month": "2026-02", "apps": 1277, "records": 35792483 },
    { "month": "2026-03", "apps": 1390, "records": 39287022 }
  ]
}`
        )}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/children",
          "Paginated list of all child applications with status, environment, usage metrics, and activity timestamps.",
          [
            "parentId (path) — Parent application ID",
            "status (query, optional) — \"active\" | \"zombie\" | \"all\"",
            "environment (query, optional) — \"prod\" | \"nonprod\" | \"all\"",
            "sortBy (query, optional) — \"records\" | \"searches\" | \"createdAt\"",
            "page (query, optional) — Page number (default: 0)",
            "hitsPerPage (query, optional) — Results per page (default: 100)",
          ],
          `{
  "parentId": "EKVXKN7L76",
  "children": [
    {
      "appId": "1CMA1NNM6L",
      "name": "cm-p100417-e924025",
      "status": "active",
      "environment": "prod",
      "records": 14517565,
      "searches": 3,
      "createdAt": "2024-07-16",
      "lastActivity": "2026-03-24"
    }
  ],
  "pagination": { "page": 0, "hitsPerPage": 100, "totalHits": 1485, "totalPages": 15 }
}`
        )}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/engagement/summary",
          "Engagement breakdown by app status and environment, with concentration metrics.",
          [
            "parentId (path) — Parent application ID",
          ],
          `{
  "parentId": "EKVXKN7L76",
  "byStatus": {
    "active": 815,
    "zombie": 297,
    "recordsOnly": 157,
    "searchOnly": 121
  },
  "byEnvironment": {
    "prod": { "apps": 1099, "records": 32747180, "searches": 13289732 },
    "nonprod": { "apps": 343, "records": 2073790, "searches": 373672 }
  },
  "concentration": {
    "top10RecordShare": 71.7,
    "top10SearchShare": 67.5
  }
}`
        )}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/analytics/top-queries",
          "Top search queries aggregated across the entire parent family, filterable by environment.",
          [
            "parentId (path) — Parent application ID",
            "environment (query, optional) — \"prod\" | \"nonprod\" | \"all\"",
            "limit (query, optional) — Number of results (default: 50)",
          ],
          `{
  "parentId": "EKVXKN7L76",
  "queries": [
    { "query": "product catalog", "count": 84200, "apps": 312 },
    { "query": "asset search", "count": 67100, "apps": 285 },
    { "query": "content fragment", "count": 51400, "apps": 198 }
  ]
}`
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          REFERENCE IMPLEMENTATION
          ═══════════════════════════════════════════════════════ */}
      <div className="sec">
        {sectionTitle("Reference Implementation")}
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            This dashboard is the proof of concept. Every chart, gauge, and table in the first three tabs
            was built by manually processing 93 weekly CSV exports from Hex. When these endpoints exist,
            this dashboard wires directly to the API &mdash; no manual steps, real-time data.
          </p>
        </div>
        <div className="flex">
          <div className="kpi">
            <div className="kpi-label">Child Apps Tracked</div>
            <div className="kpi-value" style={{ color: "#003DFF" }}>1,485</div>
            <div className="kpi-sub">Across prod + nonprod parents</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Weekly CSVs Processed</div>
            <div className="kpi-value" style={{ color: "#003DFF" }}>93</div>
            <div className="kpi-sub">Manual Hex exports to date</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Time Saved / Week</div>
            <div className="kpi-value" style={{ color: "#16a34a" }}>~3h</div>
            <div className="kpi-sub">Eliminated with API</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Customers Affected</div>
            <div className="kpi-value" style={{ color: "#d97706" }}>N+1</div>
            <div className="kpi-sub">Every parent-child account</div>
          </div>
        </div>
      </div>

      {/* ═══════ FOOTER ═══════ */}
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          marginTop: 28,
          paddingTop: 14,
          textAlign: "center",
          color: "#9698C3",
          fontSize: 12,
          letterSpacing: 0.5,
        }}
      >
        Adobe OEM Analytics Dashboard &middot; R&amp;D API Brief &middot; Algolia Strategic Partnerships &middot; Arijit Chowdhury &middot; April 2026
      </div>
    </>
  );
}
