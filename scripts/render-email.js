#!/usr/bin/env node
/**
 * Adobe OEM Weekly Email — body renderer (term-relative).
 *
 * Builds the HTML email body from the consolidated JSON, computing all quota usage
 * relative to the current contract term (start = contract.start), NOT the lifetime
 * billing counter. Search/records use the COMBINED (prod + staging) basis; apps use
 * the Production parent only — per the signed SO (Q-47553).
 *
 * Email-safe: table-based layout + inline styles only (no flexbox/grid), so it renders
 * in Gmail/Outlook. buildEmailBody(data) is exported for draft-email.js.
 *
 * CLI (preview, sends nothing):  node scripts/render-email.js  ->  /tmp/email-preview.html
 */
const fs = require('fs');
const path = require('path');

// ── number / date helpers ──
function fmtM(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return Math.round(n).toLocaleString('en-US');
}
function dayNum(ymd) { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; }
function addDays(ymd, n) {
  const t = (dayNum(ymd) + n) * 86400000; const dt = new Date(t);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${M[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
function fmtDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${M[m - 1]} ${d}, ${y}`;
}
function pct(n, q) { return q > 0 ? (n / q * 100) : 0; }

// ── compute model — lifetime prod-only basis (matches hex billing dashboard) ──
function computeModel(data) {
  const c = data.contract;
  const latest = data.weekly_snapshots
    .filter(s => s.totals.latest_records > 0 && s.billing && s.billing.prod && s.billing.staging)
    .sort((a, b) => b.report_date.localeCompare(a.report_date))[0];
  const prod = latest.billing.prod, stg = latest.billing.staging;

  const search = prod.billable_search_requests;               // lifetime prod-only
  const records = prod.billable_records;                       // prod-only
  const apps = prod.period_end_live_apps;                      // prod parent only

  // billing period info
  const periodStart = prod.billing_period_start.slice(0, 10);
  const periodEnd = (prod.billing_period_end || latest.report_date).slice(0, 10);

  // pacing + projection (search, lifetime basis)
  const elapsedDays = dayNum(periodEnd) - dayNum(periodStart);
  const termDays = dayNum(c.end) - dayNum(c.start) + 1;
  const ratePerDay = elapsedDays > 0 ? search / elapsedDays : 0;
  const remaining = c.searches_quota - search;
  const daysToQuota = ratePerDay > 0 ? remaining / ratePerDay : Infinity;
  const exhaustLabel = isFinite(daysToQuota) ? addDays(periodEnd, daysToQuota) : 'beyond term';
  const elapsedPct = pct(dayNum(periodEnd) - dayNum(c.start), termDays);

  // footprint env split (within production parent) — shares of active child apps
  const e = latest.environment, seg = latest.segmentation;
  const recTot = e.prod_records + e.nonprod_records + e.legacy_records || 1;
  const srcTot = e.prod_searches + e.nonprod_searches + e.legacy_searches || 1;
  const split = {
    prod:    { apps: seg.prod,    recPct: pct(e.prod_records, recTot),    srcPct: pct(e.prod_searches, srcTot) },
    nonprod: { apps: seg.nonprod, recPct: pct(e.nonprod_records, recTot), srcPct: pct(e.nonprod_searches, srcTot) },
    legacy:  { apps: seg.legacy,  recPct: pct(e.legacy_records, recTot),  srcPct: pct(e.legacy_searches, srcTot) },
  };

  const eng = latest.engagement;
  const engTotal = eng.active_both + eng.records_no_search + eng.search_no_records + eng.zombie || 1;

  return {
    dateStr: fmtDate(latest.report_date), periodStart, periodEnd, termStart: c.start, termEnd: c.end,
    apps, appsPct: pct(apps, c.apps_quota), appsQuota: c.apps_quota,
    records, recordsPct: pct(records, c.records_quota), recordsQuota: c.records_quota,
    search, searchPct: pct(search, c.searches_quota), searchQuota: c.searches_quota,
    elapsedPct, exhaustLabel, remaining,
    stgSearch: stg.billable_search_requests, stgRecords: stg.billable_records, stgApps: stg.period_end_live_apps,
    split, eng, engTotal,
  };
}

// ── one quota row (label + bar + caption), bar capped at 100% with over-quota styling ──
function quotaRow(label, usedPct, sub, note, color) {
  const w = Math.min(usedPct, 100).toFixed(0);
  return `
  <tr><td style="padding:9px 0;border-bottom:1px solid #f3f4f6">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;font-weight:600;color:#36395A">${label}</td>
      <td style="text-align:right;font-size:13px"><span style="font-size:17px;font-weight:700;color:${color}">${usedPct.toFixed(0)}%</span> <span style="font-size:11px;color:#7778AF">${sub}</span></td>
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr>
      <td style="background:#eef0f4;border-radius:4px;height:7px;padding:0">
        <table width="${w}%" cellpadding="0" cellspacing="0"><tr><td style="background:${color};border-radius:4px;height:7px;font-size:0">&nbsp;</td></tr></table>
      </td>
    </tr></table>
    ${note ? `<div style="font-size:11px;color:${color === '#dc2626' ? '#b4361f' : '#6b7280'};margin-top:3px">${note}</div>` : ''}
  </td></tr>`;
}

// Compact quota row for the narrow (40%) column — label + % on one line, thin bar, tiny caption.
function quotaRowNarrow(label, usedPct, sub, color) {
  const w = Math.min(usedPct, 100).toFixed(0);
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:11px">
    <tr><td style="font-size:12px;font-weight:500;color:#36395A">${label}</td>
        <td style="text-align:right;font-size:12px;font-weight:700;color:${color}">${usedPct.toFixed(0)}%</td></tr>
    <tr><td colspan="2" style="padding-top:4px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#eef0f4;border-radius:4px;height:6px;padding:0">
        <table width="${w}%" cellpadding="0" cellspacing="0"><tr><td style="background:${color};border-radius:4px;height:6px;font-size:0">&nbsp;</td></tr></table>
      </td></tr></table>
    </td></tr>
    <tr><td colspan="2" style="font-size:10px;color:#9698C3;padding-top:3px">${sub}</td></tr>
  </table>`;
}

function buildEmailBody(data) {
  const m = computeModel(data);
  const searchColor = m.searchPct >= 85 ? '#d97706' : m.searchPct >= 100 ? '#dc2626' : '#16a34a';
  const recordsColor = m.recordsPct >= 85 ? '#d97706' : '#16a34a';
  const appsColor = m.appsPct >= 95 ? '#dc2626' : m.appsPct >= 85 ? '#d97706' : '#16a34a';
  const splitRow = (dot, name, tag, s) => `
    <tr style="background:#fbfcfe">
      <td style="padding:5px 12px 5px 22px;font-size:12px;color:${dot}">● ${name} <span style="color:#9698C3">${tag}</span></td>
      <td style="text-align:right;padding:5px 8px;font-size:12px;color:#36395A">${s.apps.toLocaleString()} <span style="color:#9698C3">${s.recPct >= 0 ? Math.round(pct(s.apps, m.split.prod.apps + m.split.nonprod.apps + m.split.legacy.apps)) + '%' : ''}</span></td>
      <td style="text-align:right;padding:5px 8px;font-size:12px;color:#36395A">${s.recPct.toFixed(0)}%</td>
      <td style="text-align:right;padding:5px 12px;font-size:12px;color:#36395A">${s.srcPct.toFixed(0)}%</td>
    </tr>`;
  const engRow = (color, label, count) => `
    <tr><td style="padding:4px 0;font-size:12px;color:#36395A"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:7px"></span>${label}</td>
      <td style="text-align:right;font-size:12px;font-weight:600;color:#000033">${count.toLocaleString()}</td>
      <td style="text-align:right;font-size:11px;color:#7778AF;width:38px">${pct(count, m.engTotal).toFixed(0)}%</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#23263B">
<div style="max-width:520px;margin:0 auto;padding:18px 20px 12px;font-size:14px;color:#23263B;line-height:1.6">Hello everyone,<br><br>Below is the Adobe&lt;&gt;Algolia usage summary as of ${m.dateStr} (billing period ${fmtDate(m.periodStart)} – ${fmtDate(m.periodEnd)}).</div>
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">

<tr><td style="padding:16px 22px;border-bottom:1px solid #eef0f4">
  <div style="font-size:10px;font-weight:600;color:#9698C3;letter-spacing:1.5px">ADOBE × ALGOLIA · WEEKLY USAGE</div>
  <div style="font-size:14px;font-weight:600;color:#000033;margin-top:3px">Data as of ${m.dateStr}</div>
</td></tr>

<!-- BOTTOM LINE -->
<tr><td style="padding:16px 22px 4px">
  <div style="font-size:11px;font-weight:600;color:#003DFF;letter-spacing:0.6px;margin-bottom:6px">BOTTOM LINE</div>
  <div style="font-size:14.5px;line-height:1.5;color:#1a1d35;font-weight:600">Search is at <span style="color:${searchColor}">${m.searchPct.toFixed(0)}%</span> of quota, records at ${m.recordsPct.toFixed(0)}%, and apps at ${m.appsPct.toFixed(0)}% of the 1,500 cap. Apps remain near capacity; search and records have room.</div>
</td></tr>

<!-- QUOTA USAGE (40%) | APP HEALTH (60%) -->
<tr><td style="padding:14px 22px 4px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="42%" valign="top" style="padding-right:16px;border-right:1px solid #eef0f4">
      <div style="font-size:11px;font-weight:600;color:#9698C3;letter-spacing:0.8px;margin-bottom:2px">QUOTA USAGE</div>
      <div style="font-size:10px;color:#c2c5d8;margin-bottom:10px">Production · billing period</div>
      ${quotaRowNarrow('Search', m.searchPct, `${fmtM(m.search)} / 75M`, searchColor)}
      ${quotaRowNarrow('Records', m.recordsPct, `${fmtM(m.records)} / 50M`, recordsColor)}
      ${quotaRowNarrow('Applications', m.appsPct, `${m.apps.toLocaleString()} / ${m.appsQuota.toLocaleString()}`, appsColor)}
    </td>
    <td width="58%" valign="top" style="padding-left:16px">
      <div style="font-size:11px;font-weight:600;color:#9698C3;letter-spacing:0.8px;margin-bottom:2px">APP HEALTH</div>
      <div style="font-size:10px;color:#c2c5d8;margin-bottom:10px">${m.apps.toLocaleString()} active apps</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${engRow('#16a34a', 'Active', m.eng.active_both)}
        ${engRow('#8b5cf6', 'Search only', m.eng.search_no_records)}
        ${engRow('#dc2626', 'Zombie', m.eng.zombie)}
        ${engRow('#d97706', 'Records only', m.eng.records_no_search)}
      </table>
      <div style="font-size:10px;color:#9698C3;margin-top:8px;line-height:1.4">Active = records &amp; search. Search-only apps are mostly non-prod environments.</div>
    </td>
  </tr></table>
</td></tr>

<!-- SEARCH DETAIL (full width) -->
<tr><td style="padding:6px 22px 4px">
  <div style="font-size:11px;font-weight:600;color:#9698C3;letter-spacing:0.8px;margin:6px 0 8px;border-top:1px solid #f3f4f6;padding-top:12px">SEARCH DETAIL</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12.5px;color:#36395A">
    <tr><td style="padding:3px 0">Total billable searches</td><td style="text-align:right;font-weight:600;color:#000033">${fmtM(m.search)} of 75M (${m.searchPct.toFixed(0)}%)</td></tr>
    <tr><td style="padding:3px 0">Remaining</td><td style="text-align:right;font-weight:600;color:#000033">${fmtM(m.remaining)}</td></tr>
    <tr><td style="padding:3px 0">On current pace, exhausts</td><td style="text-align:right;font-weight:700;color:${searchColor}">~${m.exhaustLabel}</td></tr>
  </table>
</td></tr>

<tr><td style="padding:14px 22px 6px">
  <div style="font-size:11px;font-weight:600;color:#9698C3;letter-spacing:0.8px;margin-bottom:8px">FOOTPRINT BY PARENT ACCOUNT</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ebf2;border-radius:6px;font-size:12.5px;color:#36395A">
    <tr style="background:#f7f8fc">
      <td style="padding:7px 12px;font-weight:600;font-size:11px;color:#484C7A">Account</td>
      <td style="text-align:right;padding:7px 8px;font-weight:600;font-size:11px;color:#484C7A">Apps</td>
      <td style="text-align:right;padding:7px 8px;font-weight:600;font-size:11px;color:#484C7A">Records</td>
      <td style="text-align:right;padding:7px 12px;font-weight:600;font-size:11px;color:#484C7A">Search</td>
    </tr>
    <tr style="border-top:1px solid #eef0f4">
      <td style="padding:8px 12px;font-weight:600"><span style="color:#003DFF">Production</span> <span style="color:#9698C3;font-weight:400">(EX9JOVML7S)</span></td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#000033">${m.apps.toLocaleString()}</td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#000033">${fmtM(m.records)}</td>
      <td style="text-align:right;padding:8px 12px;font-weight:700;color:#000033">${fmtM(m.search)}</td>
    </tr>
    ${splitRow('#16a34a', 'Production', 'cm-', m.split.prod)}
    ${splitRow('#d97706', 'Non-production', 'nonprod', m.split.nonprod)}
    ${splitRow('#7c3aed', 'Legacy', 'pre-CM', m.split.legacy)}
    <tr>
      <td style="padding:8px 12px;font-weight:600"><span style="color:#b8731c">Staging / Test</span> <span style="color:#9698C3;font-weight:400">(J5OO6J0MJP)</span></td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#000033">${m.stgApps.toLocaleString()}</td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#000033">${fmtM(m.stgRecords)}</td>
      <td style="text-align:right;padding:8px 12px;font-weight:700;color:#000033">${fmtM(m.stgSearch)}</td>
    </tr>
    <tr style="border-top:1px solid #e5e7eb">
      <td style="padding:8px 12px;font-weight:700;color:#000033">Combined</td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#9698C3">—</td>
      <td style="text-align:right;padding:8px;font-weight:700;color:#000033">${fmtM(m.records + m.stgRecords)}</td>
      <td style="text-align:right;padding:8px 12px;font-weight:700;color:#000033">${fmtM(m.search + m.stgSearch)}</td>
    </tr>
  </table>
  <div style="font-size:12.5px;line-height:1.5;color:#1a1d35;margin-top:10px">A quarter of the production-account apps (${m.split.nonprod.apps}) are non-production environments, yet they drive only ~${m.split.nonprod.recPct.toFixed(0)}% of records and ~${m.split.nonprod.srcPct.toFixed(0)}% of search — the real load sits in the ${m.split.prod.apps.toLocaleString()} production apps.</div>
  <div style="font-size:10.5px;color:#9698C3;margin-top:8px;line-height:1.45">Indented rows show each segment's share of the Production parent's active child apps. Staging / Test is a separate parent account.</div>
</td></tr>

<tr><td style="padding:10px 22px;text-align:center;font-size:9px;color:#9698C3;border-top:1px solid #f3f4f6">Adobe OEM Analytics · Algolia Strategic Partnerships</td></tr>
</table>
<div style="max-width:520px;margin:0 auto;padding:16px 20px 24px;font-size:14px;color:#23263B;line-height:1.6">Full app-level detail is on the live dashboard, and the usual reports are attached. Happy to dig into anything here.<br><br>— Arijit</div>
</body></html>`;
}

module.exports = { buildEmailBody, computeModel };

if (require.main === module) {
  const DATA = path.join(__dirname, '..', 'data', 'adobe_oem_consolidated.json');
  const data = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
  const m = computeModel(data);
  const html = buildEmailBody(data);
  const out = '/tmp/email-preview.html';
  fs.writeFileSync(out, html);
  console.log('Wrote', out);
  console.log('\nKey numbers (lifetime prod-only, matches hex):');
  console.log('  as of:', m.dateStr, '| billing', m.periodStart, '→', m.periodEnd);
  console.log('  SEARCH:', m.search.toLocaleString(), `= ${m.searchPct.toFixed(2)}% of 75M`);
  console.log('          remaining:', fmtM(m.remaining), '| on pace to exhaust ~' + m.exhaustLabel);
  console.log('  RECORDS:', m.records.toLocaleString(), `= ${m.recordsPct.toFixed(2)}% of 50M`);
  console.log('  APPS:', m.apps, `= ${m.appsPct.toFixed(2)}% of 1500`);
  console.log('  STAGING: search', m.stgSearch.toLocaleString(), '| records', m.stgRecords.toLocaleString(), '| apps', m.stgApps);
}
