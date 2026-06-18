I have everything I need. The repo details confirm the verifier's evidence (REPORTS_DIR path, the two `read -p` prompts at lines 45/58, the PDF attachment block at lines 566-568, `gmail.compose` scope, `consolidate.py` takes a path arg via `sys.argv[1]`). Here is the roadmap.

---

# Automation Roadmap — Removing the Manual Databricks Download + Manual Run

**Scope:** kill the weekly "log into Databricks, download 3 files, drop into a dated Drive folder, run `update.sh`, answer two prompts" routine. The email to Adobe stays a human-reviewed draft until you explicitly decide otherwise.

**One-line framing (the honest version):** The two `[y/N]` prompts are *not* the bottleneck. The real manual labor is the Databricks login + download. Automating only the prompts automates the cheap 10% and leaves the expensive 90% intact. So the architecture is built around one unlock — pulling Databricks data programmatically — and everything else falls out of that.

---

## 1. Current flow vs. target flow

```
CURRENT (manual, ~weekly)
─────────────────────────────────────────────────────────────────────────
 [HUMAN] Log into Databricks ──> run query ──> download 3 files
            │                                    ├─ all_children_daily_usage_<ts>.csv  (~23 MB)
            │                                    ├─ stage_prod_parent_agg_stat_<ts>.csv (314 B)
            │                                    └─ dashboard PDF export
            ▼
 [HUMAN] Create Drive folder  "Adobe-oem-usage-DD-Month-YYYY"  ──> drop 3 files in
            ▼
 [HUMAN] ./scripts/update.sh
            ├─ python3 consolidate.py  (CSV ──> data/adobe_oem_consolidated.json)
            ├─ [y/N] git push  ──> Vercel redeploy
            └─ [y/N] node draft-email.js  ──> Gmail DRAFT
            ▼
 [HUMAN] Open draft, review numbers, click Send ──> ~12 Adobe stakeholders (Dom LaCava et al.) + Algolia CC
                              ▲
            5 manual touchpoints. The Databricks one needs a browser + a person.


TARGET (Phase 2 — scheduled, one human gate)
─────────────────────────────────────────────────────────────────────────
 [SCHEDULER: weekly cron]
            ▼
 [AUTO] db_fetch.py
            ├─ Statement Execution REST API (EXTERNAL_LINKS, CSV) ──> daily-usage CSV
            └─ databricks-sql-connector                           ──> billing CSV
            │   writes both into a fresh dated folder
            ▼
 [AUTO] consolidate.py ──> data/adobe_oem_consolidated.json
            ▼
 [AUTO] validate (anomaly guards) ──> git push (if changed) ──> Vercel redeploy
            ▼
 [AUTO] draft-email.js  ──> Gmail DRAFT  + Slack "report ready for review" ping
            ▼
 ══════════ HUMAN APPROVAL GATE ══════════
 [HUMAN] review draft ──> click Send ──> Adobe stakeholders
                              ▲
            1 manual touchpoint: the send. Everything upstream is hands-off.
```

The PDF disappears from both flows (see §2). The Drive-folder step is created by the script, not a person.

---

## 2. Recommended architecture (plain English)

**The single biggest change, and the only one that actually matters for "hands-off," is teaching the pipeline to fetch its own data from Databricks.** Until that exists, no scheduler — local cron, GitHub Actions, Vercel — is truly unattended, because today nothing in the repo talks to Databricks; `consolidate.py` walks a local Drive folder and `draft-email.js` reads attachments from the same folder. Pick that one battle and the rest is plumbing you already have.

### Primary approach for Databricks extraction — and why

**Add one new script, `scripts/db_fetch.py`, that runs both queries and lands the two CSVs in a dated folder, then make it step 0 of `update.sh`.** Inside it, split by result size:

- **The ~23 MB daily-usage query → SQL Statement Execution REST API**, `POST /api/2.0/sql/statements` with `format=CSV`, `disposition=EXTERNAL_LINKS`, `wait_timeout=30s`, `on_wait_timeout=CONTINUE`, then poll `GET /api/2.0/sql/statements/{id}` until `SUCCEEDED`, and fetch each chunk's presigned URL with a **plain HTTP GET and NO `Authorization` header** (verifier-confirmed; the docs explicitly warn that sending the header to S3 leaks your Databricks credentials). **Why EXTERNAL_LINKS, not INLINE:** INLINE hard-fails above 25 MiB — verifier-confirmed verbatim: "Statements with disposition=INLINE are limited to 25 MiB and will fail when this limit is exceeded." At ~23 MB and growing weekly you are at ~92% of that ceiling, so INLINE will "work in testing, fail in production" the week it crosses. EXTERNAL_LINKS returns RFC-4180 CSV byte-identical to the manual export, so `consolidate.py` needs zero parsing changes.

- **The 314-byte billing query → `databricks-sql-connector`** (`from databricks import sql`). Five lines, no REST polling dance: `sql.connect(server_hostname, http_path, ...)`, `cursor.execute(sql)`, `cursor.fetchall()`, write the 8 columns `consolidate.py` expects via `csv.writer` using `cursor.description` for headers.

**Why this over the alternatives:** It kills the manual login+download with the fewest moving parts, reuses the existing Python/`consolidate.py` stack, needs no server-side infrastructure, and leaves `consolidate.py` and `draft-email.js` essentially untouched. The Databricks Jobs API + Unity Catalog Volume + Files API design is the right scale-up *only if* you need extraction to run when the Mac is off, or you want server-side retries/alerting — for a single once-weekly two-query report it is over-engineered. Defer it.

**Auth — and why:** Use an **OAuth M2M service principal**, not a personal access token. Verifier-confirmed: "Databricks recommends using a Databricks service principal and its token instead of your Databricks user or your Databricks personal access token... to give CI/CD platforms access." A PAT inherits your full workspace permissions and never expires until revoked — a standing long-lived secret sitting on a scheduled job is a real blast-radius problem. OAuth M2M tokens live ~1 hour and the connector/SDK auto-refreshes them, so you never hand-manage the expiry.

> **Verifier correction applied — the connector OAuth parameter names.** The research's snippet `sql.connect(..., auth_type='oauth', client_id=..., client_secret=...)` is **refuted** — those parameter names do not exist and will fail at connect time. The correct M2M form is:
> ```python
> from databricks import sql
> conn = sql.connect(
>     server_hostname=os.environ["DATABRICKS_HOST"],
>     http_path=os.environ["DATABRICKS_HTTP_PATH"],
>     auth_type="databricks-oauth",          # NOT "oauth"
>     oauth_client_id=os.environ["DATABRICKS_CLIENT_ID"],   # NOT client_id=
>     # the client secret is supplied via env var / stdin — there is NO client_secret kwarg
> )
> ```
> Source per verifier: databricks-sql-python `authentication.md`. Set the secret in the environment (the connector reads it); do not pass a `client_secret=` keyword.
> Note: `use_cloud_fetch` defaults to `True` already, so passing it explicitly is harmless but unnecessary.

**~~Drop the PDF.~~ OVERRIDDEN (user, 2026-06-17): KEEP the PDF + both CSVs attached to every email — hard requirement.** Because the PDF has no clean programmatic export, automation must actively produce/obtain it as part of the fetch step (not skip it): configure a **native Databricks AI/BI scheduled PDF subscription** on the dashboard (verifier-confirmed: PDF snapshot, selectable pages, optional tabular attachment, email/Slack/Teams delivery), or generate a PDF, and land it in the dated folder alongside the two CSVs so `draft-email.js` attaches all three exactly as it does today. The original "drop it / replace with a dashboard link" recommendation is retained below for context only — do not follow it.

> ~~Original (do not follow): It is the one artifact with no clean programmatic export, and it is a frozen snapshot of a dashboard that already exists live at the Vercel URL. Remove it from the attachment list in `draft-email.js` and replace "Detailed reports are attached." with a "View the live dashboard" button.~~

### Primary approach for scheduling — and why

**Phase the scheduler to the phase of trust. Start with macOS `launchd` (local), graduate to GitHub Actions (cloud) only when you want it to run with the Mac off.**

- **`launchd` LaunchAgent** is the right Phase-1/2 home: it runs in your user session, so it inherits the Google Drive mount and the existing `token.json`/`credentials.json` with **zero secrets migration**. The honest limitation: it only fires if the Mac is awake at trigger time (it runs a missed job once on next wake, not a perfect catch-up). For a weekly report where you'll review the draft anyway, that's acceptable.

- **GitHub Actions** is the better *long-term* unattended home (cloud runner, no Mac required), but the verifier confirms two real caveats: schedule events are best-effort ("can be delayed during periods of high loads... some queued jobs may be dropped") and public repos auto-disable scheduled workflows after 60 days of inactivity. For a weekly job a 10–30 min drift is irrelevant, and the weekly JSON commit keeps the repo active so the 60-day rule won't bite. The cost is real secrets migration (Databricks SP creds + Gmail `credentials.json`/`token.json` as encrypted secrets) — which is why it's Phase 3, not Phase 1.

- **Do NOT use Vercel Cron as the orchestrator.** It's an HTTP-GET-to-a-serverless-function model with an ephemeral filesystem and no way to git-push back to itself — the wrong execution model for a fetch + consolidate + commit + email pipeline. (The exact function-duration tiers the research quoted are *uncertain* per the verifier and shift over time, so I'm not relying on those numbers — the architectural mismatch alone is the disqualifier.) The existing "git push → Vercel redeploy" flow already keeps the dashboard fresh; Vercel Cron adds nothing here.

**Gmail send needs no new scope.** Verifier-confirmed: `drafts.send` accepts `gmail.compose`, which `token.json` already carries. So flipping from "create draft" to "auto-send" is a one-line code change, never a re-auth — which is exactly why the human gate is a *policy* choice, not a technical limitation.

---

## 3. Phased roadmap

### Phase 1 — Quick win (low effort, ~1 day): one command that fetches + runs, still local, still draft-for-review

**What gets built**
- `scripts/db_fetch.py` (the primary extraction approach above) — runs both queries, creates the dated folder `Adobe-oem-usage-DD-Month-YYYY` using today's date, lands the two CSVs there exactly where the manual download used to go.
- `update.sh` gains a **step 0** that calls `db_fetch.py` before `consolidate.py`, and its two `read -p` prompts become flags (`--push`, `--email-mode=draft`) defaulting to draft so a single command runs end-to-end. Keep an interactive default for safety; only the flagged path is non-interactive.
- `draft-email.js`: remove the PDF attachment (lines 566–568), add the live-dashboard link.

**Effort:** Low. One new ~150-line script + small edits to `update.sh` and `draft-email.js`. No scheduler, no secrets infra beyond a gitignored `.env`.

**What stays manual:** You still *run* the one command, and you still review + send the draft. The Mac must be on.

**Human-in-the-loop decision:** You kick it off, and you click Send after reviewing the draft. The win: the browser login + 3-file download + folder creation — the actual pain — is gone. One terminal command replaces ~10 minutes of clicking.

---

### Phase 2 — Scheduled / unattended, with a human approval gate before Adobe (medium effort, ~2–3 days)

**What gets built**
- A `launchd` LaunchAgent (`~/Library/LaunchAgents/com.algolia.adobe-oem.plist`, `StartCalendarInterval` weekly) that runs the non-interactive `update.sh` from Phase 1 — fetch → consolidate → push (guarded by `git diff --quiet`) → create draft.
- **Anomaly/validation guards** in the pipeline that *fail the run* (and alert) rather than producing a draft, when the data looks wrong — e.g. as-of date unchanged from last week (stale pull), or the known top-10-concentration >100% quirk, or a truncated CSV. This is the precondition for ever trusting an auto-send later.
- A **Slack "report ready for review" ping** when the draft is created, so the review step isn't silently forgotten.
- **Idempotency:** before creating the draft, search Gmail for an existing message with this week's as-of date and skip if present, so a re-run doesn't produce a duplicate.

**Effort:** Medium. The plist + validation guards + Slack notify + dedupe check.

**What stays manual:** The send. A human opens the draft, sanity-checks the numbers, clicks Send.

**Human-in-the-loop decision:** This is the deliberate gate. Everything *except* the final send is hands-off. The gate sits exactly where the risk is — an external VP audience — and nowhere else.

---

### Phase 3 — Fully hands-off (only if you want it)

**What gets built**
- Migrate the orchestrator to **GitHub Actions** (`.github/workflows/weekly-oem-report.yml`, `on: schedule` + `workflow_dispatch`, `permissions: contents: write`) so it runs with the Mac off. Databricks SP creds and Gmail `credentials.json`/`token.json` move to encrypted repo secrets (injected at job start, never committed).
- **Gmail credential hardening** for true unattended send: confirm the OAuth consent screen is "In production" (verifier-confirmed: a "Testing"-status project gets a refresh token expiring in **7 days**); prefer a Workspace **service account with domain-wide delegation** so a corporate password rotation doesn't silently revoke the Gmail-scoped token; add explicit `invalid_grant` handling that alerts loudly. (Verifier-confirmed the refresh token dies on 7-day Testing, 6-month idle, and password change with Gmail scopes — "you must write your code to anticipate the possibility that a granted refresh token might no longer work.")
- **Flip to auto-send** via `gmail.users.drafts.send(draftId)` behind `SEND_MODE=draft|send` (default `draft`). No new scope.
- **Dead-man's-switch monitor** (Healthchecks.io / Cronitor): the job pings on *success*, so a dropped/never-started run alerts — GitHub's default failure email only fires when a job runs and fails, not when it never starts.

**Effort:** Medium-high, and most of it is hardening and observability, not features.

**What stays manual:** Ideally nothing — but I'd only get here after Phase 2 has produced a correct draft every week for a couple of months and the anomaly guards have proven they catch bad weeks.

**Human-in-the-loop decision:** This *removes* the gate. My recommendation is to stop at Phase 2 (see §5).

---

## 4. Concrete implementation notes for THIS repo

**Where Databricks creds live.** A new gitignored `scripts/.env` (or macOS Keychain). Four values, all read from env, never hardcoded:
```
DATABRICKS_HOST          # e.g. dbc-xxxx.cloud.databricks.com
DATABRICKS_HTTP_PATH     # /sql/1.0/warehouses/<id>  (from the warehouse "Connection details" tab)
DATABRICKS_CLIENT_ID     # service-principal OAuth client id  -> oauth_client_id=
DATABRICKS_CLIENT_SECRET # SP OAuth secret (connector reads from env; NOT a client_secret kwarg)
```
Ship a `scripts/.env.example` with these keys and **no real values**. Keep these strictly separate from `scripts/credentials.json`/`token.json`, which are Gmail-only — do not conflate.

**Secret storage / `.gitignore` — a real gap to close now.** Verifier-confirmed: `.gitignore` covers `scripts/credentials.json`, `scripts/token.json`, and `.env*.local`, but **a bare `.env` is currently committable.** Add it before anyone creates the file:
```
# Databricks credentials (NEVER commit)
scripts/.env
.env
```
(The repo already correctly gitignores the two Gmail files at lines 32–33.)

**How `consolidate.py` changes:** essentially not at all. It already takes the reports root as `sys.argv[1]` (line 525, invoked from `update.sh` line 32 as `python3 scripts/consolidate.py "$REPORTS_DIR"`) and `os.walk`s for CSVs, skipping `stage_prod_parent_agg_stat*` and `last_three_months*` files. `db_fetch.py` only has to write the daily-usage CSV and the billing CSV into a folder under `REPORTS_DIR` whose name matches the regex `Adobe-oem-usage-(\d{1,2})-(\w+)-(\d{4})` (line 131). That folder-name contract is the *only* thing `consolidate.py` cares about.

**Daily-usage chunk concatenation — two pitfalls to bake into `db_fetch.py`:**
- Each EXTERNAL_LINKS CSV chunk carries its **own header row**. Strip the first line of every chunk after the first, or `consolidate.py`'s `csv.DictReader` corrupts.
- Resolve each chunk's presigned link and fetch it **immediately**; do not pre-collect all links then download. The link TTL is short — the research cited ~15 min, but the verifier flags the exact number as *uncertain* (the `expiration` field exists; the official tutorial gave no specific value in their check). Treat the magnitude as right and the exact ceiling as unverified; the resolve-then-fetch-immediately mitigation is correct regardless.

**How `draft-email.js` changes:**
- Remove the PDF block (lines 566–568) from the attachment list; attachments become the two CSVs only.
- Change the footer to add the live-dashboard link/button.
- `findLatestFolder()` (mtime-sort of `REPORTS_DIR` subdirs, lines 286–294) keeps working as-is for the now-auto-created folder.
- For Phase 3 auto-send: capture the id from `gmail.users.drafts.create` (line 603) and call `gmail.users.drafts.send({requestBody:{id:draftId}})`, gated by `SEND_MODE`. `gmail.compose` (gmail-auth.js line 16) already covers it.

**How `update.sh` changes:** insert step 0 (`python3 scripts/db_fetch.py`) before the consolidate call at line 32; replace the two `read -p` prompts (lines 45 and 58) with flags that default to push-yes / email-mode=draft when run non-interactively; guard the commit with `git diff --quiet` so unchanged-data weeks don't create empty commits or needless redeploys. `REPORTS_DIR` is already defined at line 20 and is the path `db_fetch.py` should write into.

**Weekly schedule mechanism + real cron expression.**
- Phase 2, `launchd` (recommended): `StartCalendarInterval` `{ Weekday = 1; Hour = 9; Minute = 0; }` → Mondays 09:00 **local** time (launchd uses local time, not UTC). Wrap `update.sh` with the non-interactive flags; load with `launchctl load`. Use `caffeinate`/"Wake for network access" to reduce missed runs.
- Phase 3, GitHub Actions: `cron: '0 14 * * 1'` → Mondays **14:00 UTC** (GitHub cron is UTC-only, no `MON`/`JAN` names). Pick the hour with UTC offset in mind. Pair with `workflow_dispatch:` for manual reruns.

---

## 5. Recommendation on the human review gate — KEEP IT

**Keep the human review gate before emailing Adobe VPs. Default to draft, indefinitely, and treat auto-send (Phase 3) as opt-in only after months of proven-correct drafts.**

**The trade-off, stated honestly:**

- **Cost of keeping the gate:** ~30 seconds a week of a human opening a draft and clicking Send, plus the risk that someone forgets and a week's report goes out late (mitigated by the Phase-2 Slack "ready for review" ping). This is a *low-cost, recoverable* failure — a late report is a minor embarrassment.

- **Cost of removing the gate:** one week of bad Databricks data auto-blasts wrong numbers to ~12 senior external Adobe stakeholders (Dom LaCava et al., hardcoded recipient list) with the Algolia account team CC'd. This is a *high-cost, irreversible* failure — you cannot un-send. And the data has **known, documented landmines** that make a bad week realistic, not hypothetical: the top-10 record concentration printing >100% (a denominator-scope quirk), the May 2026 billing-methodology switch that fabricates a "-34% records / 227 zombies removed" MoM signal, the cumulative-since-2024 billing counters that overstate burn against the annual quota, and the in-progress-month understatement. Any of those, auto-sent, alarms or misleads the exact audience you're trying to build trust with.

The asymmetry is decisive: a missed week is cheap and recoverable; a wrong auto-sent week to VPs is expensive and permanent. The pipeline already does the right thing (`drafts.create`, never `drafts.send`), and `gmail.compose` makes the auto-send flip trivial *whenever you want it* — so keeping the gate costs you nothing in optionality. Move the gate, never delete the capability. Auto-send only becomes defensible once the Phase-2 anomaly guards have demonstrably caught the known data quirks before they reach a draft, across enough weeks to earn trust.

---

## 6. Risks & failure handling for an unattended job

| Risk | Why it bites | Handling |
|---|---|---|
| **Auto-send of bad data to VPs** | Highest-regret failure; known data quirks (101% concentration, May methodology reset, cumulative-vs-annual burn, partial month) make it realistic | Keep the draft gate (§5). Add validation guards that fail the run instead of drafting when anomalies fire. Auto-send only post-trust. |
| **INLINE silently crossing 25 MiB** | Daily-usage CSV at ~92% of the limit, growing weekly; works in test, hard-fails in prod the week it crosses | Use `EXTERNAL_LINKS` from day one — never INLINE for the daily-usage query. |
| **Presigned URL expiry mid-fetch** | Short TTL (exact ceiling unverified per verifier); laptop sleep / slow net between resolving a link and the GET → 403 | Resolve then fetch each chunk immediately; don't pre-collect links. Retry the whole statement on 403 rather than reusing a stale link. |
| **Stale Databricks pull** | A silently failed/cached query yields last week's numbers; auto-pipeline would re-publish identical data | Bail if the data's as-of date equals last week's. Guard the commit with `git diff --quiet` (no-op weeks → no empty commit, no needless redeploy). |
| **Duplicate VP email on rerun** | Manual rerun or cron double-fire sends the report twice | Before draft/send, Gmail-search for an existing message with this week's as-of date; skip if found. |
| **Gmail OAuth refresh-token rot** | Verifier-confirmed dies on 7-day Testing status, 6-month idle, or password change with Gmail scopes — silently, with `invalid_grant` | Consent screen "In production"; weekly runs stay inside the 6-month window; prefer a service account w/ domain-wide delegation for true unattended; explicit `invalid_grant` handling that alerts. |
| **Databricks PAT blast radius** | A PAT inherits full user perms, never expires until revoked, sits in a scheduled job | Scoped OAuth M2M service principal (CAN_USE on warehouse + SELECT on tables); auto-refreshed 1-hr tokens; PAT only as throwaway first-cut. |
| **Silent missed run** | `launchd` skips if Mac is off; GitHub cron can drop/delay under load — nobody notices for 7 days | Dead-man's-switch (Healthchecks.io/Cronitor) pinged on *success*, so a never-started run alerts. GitHub's default failure email doesn't cover never-started. |
| **Secrets sprawl in CI (Phase 3)** | Databricks + Gmail creds as repo secrets; a misconfigured workflow could echo a secret; `token.json` must never be committed | Inject from encrypted secrets at job start; keep `credentials.json`/`token.json`/`.env` gitignored; never `echo` secrets in steps. Close the bare-`.env` gitignore gap now (§4). |
| **`launchd`/GitHub schedule drift** | Best-effort timing; 10–30 min late | Irrelevant for a weekly report; documented, not mitigated. |

---

**Key files (all absolute):**
- `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/update.sh` — prompts at lines 45 & 58; `REPORTS_DIR` at line 20; consolidate call at line 32. New step 0 + flags here.
- `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/consolidate.py` — `sys.argv[1]` path arg (line 525), folder-name regex (line 131), `find_csv_files` (line 41). Unchanged; just feed it the auto-created folder.
- `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/draft-email.js` — PDF attachment at lines 566–568 (remove), `findLatestFolder` 286–294, `drafts.create` line 603.
- `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/gmail-auth.js` — `SCOPES=['gmail.compose']` line 16 (sufficient for send; no change).
- `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/.gitignore` — add `scripts/.env` and `.env` (currently only `.env*.local` is ignored).
- **New:** `/Users/arijitchowdhury/AI-Development/Adobe report/adobe-oem-dashboard/scripts/db_fetch.py`, `scripts/.env.example`, and (Phase 3) `.github/workflows/weekly-oem-report.yml`.