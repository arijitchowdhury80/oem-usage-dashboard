All confirmed. The records 40M→26.5M Apr→May drop is the methodology artifact (real). The 2026-05-19 duplicate with zombie=0/active_both=1481 confirms the degenerate-snapshot risk. Term is 37% elapsed. Searches climbed steadily 40.5M→45.8M (clean, no boundary issue post-May) — a true 6-straight-week rise. Now I have everything grounded. Writing the spec.

---

# Redesign Spec — Weekly Adobe × Algolia OEM Usage Email

## 1. Design thesis

The new email does one emotional job and one technical job at once: it makes a senior Adobe partner *feel* the two-year trajectory they've built (89 → 1,487 apps, searches now ~93× their first week) while handing them one clear, un-anxious decision — the app program is full, so let's size the headroom. Recognition is treated as feedback, not flattery: it fires only when the data genuinely earns it, names a specific attributable thing, and sits beside candor so a VP reads it as honest. Every number is grounded in the consolidated JSON, every trend renders in plain HTML tables (no JS/SVG), and the apps ceiling is reframed from a red alarm into the proof-of-success that opens the renewal conversation 7.5 months out.

---

## 2. Section-by-section spec (top → bottom)

Layout: single 520px table, light theme, one accent color reserved for the single action item. No emoji, no `✦`, no exclamation marks. Trends render as **CSS data-bars** (nested `<td width%>` + `bgcolor`) — universally safe in Gmail/Outlook — never unicode blocks or images-only.

---

### Section 1 — Bottom line (single takeaway)

- **Purpose:** State the week's meaning and the one decision in the first line. Replaces "Below is the usage summary as of <date>."
- **Data inputs:** `totals.active_apps` (1487), apps quota 1500 (contracts), `totals.total_searches` (45,752,798), term dates (2026-02-01→2027-01-31), derived term-elapsed (37%).
- **Email-safe rendering:** Bold sentence, full width, no chart.
- **Sample copy:**
  > **The app program is effectively full — 1,487 of 1,500 slots are live (99.1%) — while searches and records still have room (61% / 62% used at 37% of the term). Worth a short call to size app headroom for the 2026-27 renewal.**

> Note: avoids the killed "ceiling in 1-2 weeks / June 20-27" forecast. "Effectively full" is grounded — the series has oscillated between 1,450 and 1,487 for ~8 weeks.

---

### Section 2 — The two-year arc (trajectory, the emotional peak)

- **Purpose:** The engineered positive peak — let the reader feel what they co-built. This is the section the reader remembers.
- **Data inputs:** `weekly_snapshots[*].totals` de-duped via cleanWeeks logic. Apps 89 → 1,487; searches 491,842 → 45,752,798 (93× since first week 2024-07-22; ~5.8× YoY vs 2025-06-09's 7.92M). Use **monthly_summary** points for the bar, started **after** the May 2026 records reset for the records row only.
- **Email-safe rendering:** A coarse 6-cell microbar row per metric — last 6 months as proportional `<td>` data-bars, endpoint cell bold and accent-colored, the live number printed beside it. Apps bar overlays a thin 1500 reference cell so the "slamming into the ceiling" shape is visible.
- **Sample copy + microbar (apps, last 6 monthly points, illustrative heights from monthly_summary):**

  > **Apps** ▁▃▅▆▇█ → **1,487** of 1,500
  > _(rendered as 6 filled table cells of increasing width, final cell accent, a hairline marker at the 1,500 line)_
  >
  > **Searches** ▁▂▃▅▆█ → **45.8M** — up from 0.49M your first week (Jul 2024) and 7.9M a year ago.
  >
  > Caption: _From 89 live apps at launch to 1,487 today — and search volume up ~93× over the same period._

- **Suppression rule:** the records microbar starts at 2026-05 (post methodology switch) with a one-line footnote, so it never shows the false 40M→27M cliff.

---

### Section 3 — Health at a glance (quota + pacing)

- **Purpose:** Calm, reassuring tier. Separates the one ahead-of-pace dimension (apps) from the two healthy ones using the term-elapsed comparison — the cleanest single line that splits alarm from good news.
- **Data inputs:** `totals.active_apps`/1500, `billing.prod.billable_records` (31.14M)/50M, `billing.prod.billable_search_requests` (45.75M)/75M, term-elapsed 37%.
- **Email-safe rendering:** 3-row table, each row a label + data-bar (`<td width%>` fill + remainder) + a `% used vs 37% elapsed` column. Status carried by a word + glyph (▲/●), never color alone (dark-mode/Outlook safe).

  | Metric | Used | Pace |
  |---|---|---|
  | **Applications** | `████████████ 99%` | 99% used vs 37% of term — at capacity |
  | **Records** | `███████░░░░░ 62%` | 62% vs 37% — ahead, healthy runway |
  | **Searches** | `███████░░░░░ 61%` | 61% vs 37% — ahead, healthy runway |

- **Sample copy:** _One dimension is maxed (apps), two have comfortable room. That's the profile of deep adoption, not a problem to manage down._

> Note: searches bar uses **prod-only** (45.75M, 61%) per the consolidate.py "quota applies to production parent only" assumption. The combined prod+staging 119.5M / 159% figure is **deliberately excluded** until the staging-counts-against-quota contract question is resolved (data-risk: cumulative-since-2024 vs annual term).

---

### Section 4 — Recognition (conditional; see §3 for mechanic)

- **Purpose:** A *sometimes* line that only renders when a hardened detector fires. Most weeks: absent.
- **Data inputs:** detector outputs (see section 3 of this spec). This week's qualifying fact: searches rose for a 6th straight clean week (40.5M→45.8M), all post-May-reset, no boundary contamination.
- **Email-safe rendering:** single understated line, same weight as body text, no box, no purple, no sparkle.
- **Sample copy (this week):**
  > Search volume climbed for the sixth straight week, 40.5M → 45.8M — end users are pulling more from the deployed apps, not fewer.

---

### Section 5 — Capacity & headroom (the apps-ceiling reframe + the one ask)

- **Purpose:** Turn 99.1% into a credible expansion conversation. Carries the email's single CTA. Detailed framing in §4 of this spec.
- **Data inputs:** `active_apps` 1487/1500, `billing.prod.provisioned_apps` 1930 / `deleted_in_period_apps` 557 (label "since contract inception 2024-02-02"), term end 2027-01-31.
- **Email-safe rendering:** short paragraph + one bolded interest-based ask. Accent color used here and nowhere else.
- **Sample copy:**
  > Your teams have filled 1,487 of the 1,500 provisioned app slots and have been at that level for roughly two months — a strong signal of how embedded Algolia is across Adobe. New app creation is capped at 1,500, so this is the moment to plan headroom rather than hit a wall.
  > **Want a quick capacity + renewal-options view for the 2026-27 term?** Happy to pull it together.

---

### Section 6 — Where usage lives (optional detail, demoted)

- **Purpose:** One quiet table for the technically curious, replacing the equally-weighted wall of tables. Grounded environment split, not the contaminated concentration metric.
- **Data inputs:** `environment.{prod,nonprod,legacy}_{records,searches}` and `age_distribution`.
- **Email-safe rendering:** small 3-row table (prod / nonprod / legacy records & searches), plus optional one-line maturity note.
- **Sample copy:** _Production carries 80% of records (24.8M of 31.1M); legacy still holds 3.9M records — a low-effort cleanup target when convenient. 774 of 1,487 apps (52%) are now 12 months or older._

> Excludes `concentration.top10_records_pct` (101.1%, known >100% artifact) entirely. `top10_searches_pct` (30%) is safe and may appear as "search load is healthily spread — top 10 apps are 30% of searches."

---

### Section 7 — Footer (forward close, replaces dead ending)

- **Purpose:** The remembered ending. Replaces "Detailed reports are attached. Arijit."
- **Data inputs:** none / Vercel dashboard URL.
- **Sample copy:**
  > Next: I'll share the capacity + renewal-options view this week. Full app-level detail is on the live dashboard → oem-usage-dashboard.vercel.app. — Arijit

---

## 3. Reward / recognition mechanic

**When it fires (data-gated, not weekly).** A recognition line renders only when at least one hardened detector returns true. Each detector requires clean, de-duped snapshots (cleanWeeks) and skips any flagged-anomalous week (e.g., the 2026-05-19 duplicate with zombie=0/active_both=1481).

Detectors:
1. **Search streak** — ≥3 consecutive clean weeks of rising `total_searches`, all on the same side of the May-2026 methodology boundary (no cross-boundary spans). *Fires this week: 6 weeks.*
2. **Round-number crossing** — `total_searches` or `active_apps` crosses a 5M / 250-app threshold *for the first time and stays above for 2 weeks* (debounced against the repeated-30M-recross artifact).
3. **GenStudio adoption** — `name_tags.cmprd_genstudio` crosses a +25-app step vs 4 weeks prior (currently 290; Adobe-strategic product line).
4. **Maturity** — `age_distribution.12mo_plus` crosses 50% of active apps (currently 774/1487 = 52%, fires once).

**What it celebrates:** customer-owned outcomes only — end-user searches served, adoption breadth (`top10_searches_pct` = 30%), GenStudio footprint, app maturity. Never vendor-owned meters (records toward 50M, apps toward 1500 — those are status/expansion, not praise).

**Suppression rule:** if no detector fires, render nothing — no fallback "good week" line. A flat or down week shows the metrics plainly with zero recognition. Explicitly **never** credit Adobe for the zombie 256→37 drop (the data shows it's a calculation-definition change on 2026-05-19, not cleanup work).

**Sample VP-credible lines:**
- "Search volume crossed 45M for the first time and has risen six weeks running — your end users are pulling more from the deployed apps."
- "GenStudio now spans 290 production apps, up from ~265 a month ago — the fastest-growing slice of your footprint."
- "Search load stays healthily spread: your top 10 apps are 30% of all searches, down from ~91% early in the partnership — broad adoption, not a few heavy users."

---

## 4. Near-ceiling apps quota (99.1%) — exact framing

**Out of red, into capacity-demand.** Move 1487/1500 out of any "Concerns" block. Frame as: *one maxed dimension = deep adoption; two with runway = healthy*.

**Urgency without anxiety — the exact wording:**
> Your teams have filled 1,487 of 1,500 provisioned app slots and have held at that level for ~2 months. New app creation caps at 1,500 — so this is the moment to plan headroom, not a fire to put out.

**Why this avoids both traps:**
- No fabricated countdown. The series oscillates 1,450–1,487; I verified there is no clean linear runway, so "held at that level for ~2 months" is the honest, and stronger, signal. The killed "~June 20-27" date stays killed.
- Loss-framed truthfully (capped creation is a real contractual limit, SO Q-47553) but paired with the calm records/searches runway so the *net* feeling is confident partnership, not dread.

**The conversation opener (single interest-based ask):**
> Want a quick capacity + renewal-options view for the 2026-27 term?

Escalate specificity as 2027-01-31 nears; keep it interest-based ("want a view?") not a hard meeting demand.

---

## 5. What to CUT from today's email

1. **"Below is the … summary as of <date>"** intro — replaced by the bottom-line takeaway.
2. **The purple "Glimmers" box and the `✦` glyph** — recognition becomes a conditional plain line, not an always-on decorated block.
3. **The `⚠` glyph and all red on the apps quota** — apps moves to the capacity section; reserve the one accent color for the single ask.
4. **`top10_records_pct` (101.1%)** — the >100% artifact; never surface until reconciled.
5. **Combined prod+staging search exposure (119.5M / 159%)** — blocked on the cumulative-vs-annual + staging-counts-against-quota contract questions.
6. **The full Billing-by-Parent table as a co-equal block** — demote to the dashboard link; keep at most the clean environment split (§6).
7. **"Detailed reports are attached. Arijit."** dead ending — replaced by the forward close + dashboard link.
8. **Any cross-May-boundary MoM on records/zombie** — the 40M→27M drop and 256→29 zombie shift are methodology artifacts; never headline them.

---

## 6. Prioritized build backlog (mapped to feasibility ratings)

**P0 — ship next email (all rated `high`, zero new data risk):**
- BLUF takeaway line (§1) — copy change in draft-email.js.
- Apps-ceiling reframe out of red → capacity section + single ask (§5). *Feasibility: high; inputs already in billing.prod + contracts.*
- Quota + pacing table with `% used vs 37% term-elapsed` (§3). *high — term math from contract dates.*
- Conditional recognition line with search-streak detector, hardened against the May boundary + 2026-05-19 dup (§4). *Maps to feasibility "Reward/milestone line: medium" — start with the streak detector only.*
- Cut list items 1–8.
- Footnote/suppress the known quirks (101.1%, May reset, May-19 anomaly) — reuse `cleanWeeks` from data.ts instead of the inline re-implementation.

**P1 — next 2-3 weeks:**
- Two-year microbar trajectory (§2) via monthly_summary, records row starting post-May-reset. *Feasibility: high (table version); skip PNG sparklines to stay JS-free.*
- Environment "where usage lives" table (§6). *high.*
- GenStudio + maturity detectors added to the recognition library (§3). *GenStudio: medium — name-prefix heuristic fragility; gate on 4-week step.*
- Reuse canonical `computeRates`/`computeObservations`/`computeMonths`/`formatters` from the TS source via a small build step, instead of the diverging hand-ported copies in draft-email.js (feasibility audit's reusable-logic list).

**P2 — defer / blocked:**
- Per-app named top-movers (§ audit "Top weekly movers"). *high feasibility but app IDs are opaque (cm-p…) — needs a friendly-name map before showing execs; only Adobe-GMO_prod / GenStudio are name-safe.*
- Combined prod+staging search exposure bar. *medium but BLOCKED on the contract question (staging counts against the 75M annual quota? cumulative-since-2024 vs annual term). Do not ship until resolved.*
- Provisioned/deleted lifecycle row (1930 provisioned / 557 deleted since inception). *high, but low narrative urgency; add only if a week is otherwise thin.*

---

**Key grounding corrections I made vs the inputs:** The editor's "+6/4wk, +36/8wk" recompute is what's actually wrong — on the de-duped clean series the trailing net adds are +37/4wk, +139/8wk, +133/12wk (verified). But the week-to-week series oscillates hard (+103, −77, +71), so neither the editor's "3-9 weeks" nor the storyteller's "1-2 weeks" date is defensible. The grounded framing is "held near the ceiling for ~2 months," which I used throughout. Searches are genuinely 93× the first week and ~5.8× YoY (not 85× or 9×), and the 6-week search streak is real and boundary-clean. Relevant file: `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/draft-email.js` (copy + section changes) and `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/data/adobe_oem_consolidated.json` (verified source).