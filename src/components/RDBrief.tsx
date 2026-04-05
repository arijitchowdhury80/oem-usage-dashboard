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
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#9698C3",
              textTransform: "uppercase" as const,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Parameters
          </div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {params.map((p, i) => (
              <li key={i} style={{ fontSize: 13, color: "#36395A", marginBottom: 3 }}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#9698C3",
          textTransform: "uppercase" as const,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        Example Response
      </div>
      {codeBlock(response)}
    </div>
  );

  return (
    <>
      {/* ═══════ HERO: PROBLEM + ASK (elevated 3D card) ═══════ */}
      <div className="sec">
        <div
          style={{
            background: "linear-gradient(135deg, #f8f9fb 0%, #eef0ff 100%)",
            border: "2px solid #003DFF30",
            borderRadius: 8,
            padding: "28px 28px 24px",
            boxShadow: "0 4px 20px rgba(0, 61, 255, 0.08), 0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* THE PROBLEM */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003DFF", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>
            The Problem
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#000033", lineHeight: 1.5, marginBottom: 8, letterSpacing: -0.3 }}>
            Algolia has no parent-level API. OEM partners are blind.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 0 }}>
            Adobe runs <strong style={{ color: "#003DFF" }}>1,485 child apps</strong> under one parent account.
            Algolia&apos;s APIs serve single-app owners &mdash; no endpoint answers cross-app questions like total records,
            app health, or prod vs staging breakdown. The only workaround today: a team member manually exports CSVs
            from Hex every week.
          </p>

          {/* DIVIDER */}
          <div style={{ height: 1, background: "#003DFF20", margin: "20px 0" }} />

          {/* THE ASK */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003DFF", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>
            The Ask
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
            {[
              ["Confirm", "Does an internal admin API already exist for parent-level aggregation? Or is net-new development required?"],
              ["Review", "Validate the 4 proposed endpoint schemas against internal data models and billing system structures."],
              ["Scope", "Estimate engineering effort for /usage and /children endpoints with engineering leadership."],
              ["Prioritize", "Get this into the roadmap before the Adobe renewal conversation. This is a retention lever, not a feature request."],
            ].map(([title, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 12, background: "#003DFF",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#000033" }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#484C7A", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ API CAPABILITY GAP ═══════ */}
      <div className="sec">
        {sectionTitle("API Capability Gap")}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Current API Answer</th>
                <th>Status</th>
                <th>Proposed Endpoint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total records across all child apps</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage</td>
              </tr>
              <tr>
                <td>List all child apps with status</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/children</td>
              </tr>
              <tr>
                <td>Top queries across parent family</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/analytics/top-queries</td>
              </tr>
              <tr>
                <td>Prod vs nonprod breakdown</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/engagement/summary</td>
              </tr>
              <tr>
                <td>Quota utilization</td>
                <td style={{ color: "#7778AF" }}>Billing system only</td>
                <td>{badge("PARTIAL")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage</td>
              </tr>
              <tr>
                <td>Historical usage trend</td>
                <td style={{ color: "#7778AF" }}>No endpoint</td>
                <td>{badge("MISSING")}</td>
                <td className="mono">/parents/&#123;id&#125;/usage?granularity=monthly</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ PROPOSED API SPECIFICATION ═══════ */}
      <div className="sec">
        {sectionTitle("Proposed API Specification")}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/usage",
          "Aggregate usage metrics across all child applications under a parent account, including quota percentages and monthly trend data.",
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
          "Paginated list of all child applications under a parent, with status, environment classification, and activity metrics.",
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
          "Engagement breakdown by status and environment, with concentration metrics.",
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

      {/* ═══════ ENGINEERING FEASIBILITY ═══════ */}
      <div className="sec">
        {sectionTitle("Engineering Feasibility")}
        <div className="card">
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginBottom: 12 }}>
            <strong>The data already exists.</strong> The billing system aggregates records and searches
            at the parent level to generate invoices. Hex queries the same Redshift tables to produce
            the CSVs this dashboard consumes. App metadata and parent-child relationships are in the
            application registry.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            This is an <strong>exposure problem, not a data problem</strong>. The information is available
            internally &mdash; it has no API surface for partners or internal teams to consume programmatically.
            4 read-only endpoints exposing what already exists.
          </p>
        </div>
      </div>

      {/* ═══════ WHO BENEFITS ═══════ */}
      <div className="sec">
        {sectionTitle("Who Benefits")}
        <div className="flex">
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              OEM Partners
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Adobe and all future OEM partners get self-service visibility into their
              app portfolio. No more waiting on weekly CSV exports.
            </p>
          </div>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              Multi-Tenant Customers
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Agencies, platform companies, and marketplaces managing many child apps
              under one parent. Same pattern, same need.
            </p>
          </div>
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              Algolia Partnerships Team
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Automated reporting replaces manual Hex exports. Faster QBR prep.
              Proactive quota alerts instead of reactive fire drills.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════ REFERENCE IMPLEMENTATION ═══════ */}
      <div className="sec">
        {sectionTitle("Reference Implementation")}
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            <strong>This dashboard is the reference UI.</strong> Every chart, gauge, and table in the
            first three tabs was built on manually exported CSVs. When these endpoints exist,
            wire this dashboard directly to them &mdash; zero manual intervention.
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
            <div className="kpi-sub">With API automation</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">OEM Partners Affected</div>
            <div className="kpi-value" style={{ color: "#d97706" }}>N+1</div>
            <div className="kpi-sub">Adobe first, pattern repeats</div>
          </div>
        </div>
      </div>

      {/* ═══════ PROPOSED BUILD SEQUENCE ═══════ */}
      <div className="sec">
        {sectionTitle("Proposed Build Sequence")}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Deliverable</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 1</td>
                <td>API spec and scope document (this brief)</td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 2</td>
                <td>
                  <span className="mono">/usage</span> and{" "}
                  <span className="mono">/children</span> endpoints &mdash; replaces the entire CSV workflow
                </td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 3</td>
                <td>
                  <span className="mono">/engagement/summary</span> and{" "}
                  <span className="mono">/analytics/top-queries</span> endpoints
                </td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 4</td>
                <td>Productize as OEM partner tier feature, use in renewal pitch</td>
                <td>{badge("PROPOSED")}</td>
              </tr>
            </tbody>
          </table>
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
        Adobe OEM Analytics Dashboard &middot; R&amp;D API Gap Brief &middot; Algolia Strategic Partnerships &middot; Arijit Chowdhury &middot; April 2026
      </div>
    </>
  );
}
