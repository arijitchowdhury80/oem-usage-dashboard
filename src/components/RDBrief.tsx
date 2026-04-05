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
      {/* ═══════ 1. THE PROBLEM ═══════ */}
      <div className="sec">
        {sectionTitle("1. The Problem")}
        <div className="card">
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            Algolia&apos;s public APIs are designed for <strong>single-application owners</strong>.
            OEM partners like Adobe operate at a fundamentally different scale:{" "}
            <strong style={{ color: "#003DFF" }}>1,485 child apps</strong> under one parent account.
            The public APIs cannot answer any cross-app questions &mdash; total records across all children,
            which apps are active vs zombie, production vs non-production breakdown, or top queries
            across the entire parent family.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginTop: 12 }}>
            <strong>Current workaround:</strong> manual Hex CSV export every week. A partnerships team member
            runs a Redshift query, exports a CSV, and manually reconciles data across weekly snapshots.
            This is not scalable, not self-service, and not how a platform company should serve its
            largest OEM partners.
          </p>
        </div>
      </div>

      {/* ═══════ 2. API CAPABILITY GAP ═══════ */}
      <div className="sec">
        {sectionTitle("2. API Capability Gap")}
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

      {/* ═══════ 3. PROPOSED API SPECIFICATION ═══════ */}
      <div className="sec">
        {sectionTitle("3. Proposed API Specification")}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/usage",
          "Aggregate usage metrics across all child applications under a parent account, including quota percentages and monthly trend data.",
          [
            "parentId (path) — Parent application ID",
            "granularity (query, optional) — \"daily\" | \"weekly\" | \"monthly\"",
          ],
          `{
  "parentId": "ABCD1234",
  "totalApps": 1485,
  "totalRecords": 483200000,
  "totalSearches": 12400000,
  "quotas": {
    "apps": { "used": 1485, "limit": 2000, "pct": 74.3 },
    "records": { "used": 483200000, "limit": 1000000000, "pct": 48.3 },
    "searches": { "used": 12400000, "limit": 100000000, "pct": 12.4 }
  },
  "trend": [
    { "month": "2025-10", "apps": 1320, "records": 410000000 },
    { "month": "2025-11", "apps": 1355, "records": 432000000 },
    { "month": "2025-12", "apps": 1400, "records": 455000000 }
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
  "parentId": "ABCD1234",
  "children": [
    {
      "appId": "XYZ789",
      "name": "adobe-experience-prod-us",
      "status": "active",
      "environment": "prod",
      "records": 12500000,
      "searches": 340000,
      "createdAt": "2024-03-15",
      "lastActivity": "2026-03-24"
    }
  ],
  "pagination": { "page": 0, "hitsPerPage": 100, "totalHits": 1485, "totalPages": 15 }
}`
        )}

        {endpointBlock(
          "GET",
          "/1/parents/{parentId}/engagement/summary",
          "Engagement breakdown by status (active, zombie, records-only, search-only) and environment (prod, nonprod), with concentration metrics.",
          [
            "parentId (path) — Parent application ID",
          ],
          `{
  "parentId": "ABCD1234",
  "byStatus": {
    "active": 842,
    "zombie": 310,
    "recordsOnly": 215,
    "searchOnly": 118
  },
  "byEnvironment": {
    "prod": 963,
    "nonprod": 522
  },
  "concentration": {
    "top10PctRecords": 0.78,
    "top10PctSearches": 0.85,
    "giniRecords": 0.72
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
  "parentId": "ABCD1234",
  "queries": [
    { "query": "product catalog", "count": 84200, "apps": 312 },
    { "query": "asset search", "count": 67100, "apps": 285 },
    { "query": "content fragment", "count": 51400, "apps": 198 }
  ]
}`
        )}
      </div>

      {/* ═══════ 4. ENGINEERING FEASIBILITY ═══════ */}
      <div className="sec">
        {sectionTitle("4. Engineering Feasibility")}
        <div className="card">
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            The data required to power these endpoints <strong>already exists</strong>. Records and search
            counts live in the billing system. App metadata and parent-child relationships are in the
            application registry. Historical snapshots are exported weekly to Hex via Redshift.
          </p>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7, marginTop: 12 }}>
            This is an <strong>exposure problem, not a data problem</strong>. The information is available
            internally &mdash; it simply has no API surface for partners or internal teams to consume
            programmatically.
          </p>
          <div
            style={{
              marginTop: 16,
              padding: "14px 18px",
              background: "#f3f4f6",
              borderRadius: 5,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#23263B", marginBottom: 6 }}>
              Estimated Scope
            </div>
            <div style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              4 endpoints &middot; 2&ndash;4 weeks backend engineering &middot; Read-only &middot; Internal admin API layer
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ 5. WHO BENEFITS ═══════ */}
      <div className="sec">
        {sectionTitle("5. Who Benefits")}
        <div className="flex">
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              OEM Partners
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Self-service visibility into their entire app portfolio. No more waiting on CSMs for
              weekly CSV exports. Real-time programmatic access to usage data.
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
          <div className="card" style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#000033", marginBottom: 6 }}>
              Multi-Tenant Customers
            </div>
            <p style={{ fontSize: 14, color: "#484C7A", lineHeight: 1.6 }}>
              Any customer with a parent-child app structure benefits. Adobe is the first,
              but the pattern applies to every OEM and marketplace integration.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════ 6. REFERENCE IMPLEMENTATION ═══════ */}
      <div className="sec">
        {sectionTitle("6. Reference Implementation")}
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 15, color: "#36395A", lineHeight: 1.7 }}>
            <strong>This dashboard is the reference UI.</strong> Every view in this application &mdash;
            the executive summary, trends, and portfolio health tabs &mdash; was built by manually
            processing Hex CSV exports. The endpoints proposed above would allow this same dashboard
            to run against live API data with zero manual intervention.
          </p>
        </div>
        <div className="flex">
          <div className="kpi">
            <div className="kpi-label">Child Apps Tracked</div>
            <div className="kpi-value" style={{ color: "#003DFF" }}>1,485</div>
            <div className="kpi-sub">Across 2 parent accounts</div>
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

      {/* ═══════ 7. PROPOSED BUILD SEQUENCE ═══════ */}
      <div className="sec">
        {sectionTitle("7. Proposed Build Sequence")}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Timeline</th>
                <th>Deliverable</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 1</td>
                <td>Now</td>
                <td>API spec and scope document (this brief)</td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 2</td>
                <td>Q2 2026</td>
                <td>
                  <span className="mono">/usage</span> and{" "}
                  <span className="mono">/children</span> endpoints
                </td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 3</td>
                <td>Q3 2026</td>
                <td>
                  <span className="mono">/engagement/summary</span> and{" "}
                  <span className="mono">/analytics/top-queries</span> endpoints
                </td>
                <td>{badge("PROPOSED")}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: "#000033" }}>Phase 4</td>
                <td>Q4 2026</td>
                <td>Productize as OEM partner tier feature</td>
                <td>{badge("PROPOSED")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ 8. THE ASK ═══════ */}
      <div className="sec">
        {sectionTitle("8. The Ask")}
        <div className="card">
          <ul style={{ paddingLeft: 20, margin: 0, listStyleType: "disc" }}>
            <li style={{ fontSize: 15, color: "#36395A", lineHeight: 1.8 }}>
              <strong>Confirm</strong> whether an internal admin API layer exists that could serve
              as the foundation for these endpoints, or whether net-new service development is required.
            </li>
            <li style={{ fontSize: 15, color: "#36395A", lineHeight: 1.8 }}>
              <strong>Review</strong> the proposed response schemas and confirm alignment with
              internal data models and billing system structures.
            </li>
            <li style={{ fontSize: 15, color: "#36395A", lineHeight: 1.8 }}>
              <strong>Scope Phase 2</strong> &mdash; the <span className="mono">/usage</span> and{" "}
              <span className="mono">/children</span> endpoints &mdash; with engineering leadership
              to validate the 2&ndash;4 week estimate.
            </li>
            <li style={{ fontSize: 15, color: "#36395A", lineHeight: 1.8 }}>
              <strong>Get into H1/H2 roadmap</strong> before the Adobe renewal in Q3 2026.
              This is a retention and expansion lever, not a feature request.
            </li>
          </ul>
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
