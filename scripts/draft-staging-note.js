#!/usr/bin/env node
/**
 * One-off: Gmail draft flagging the Adobe OEM staging search over-consumption.
 * Reuses gmail-auth.js (arijit.chowdhury@algolia.com). Creates a draft only — sends nothing.
 * Run: node scripts/draft-staging-note.js
 */
const { google } = require('googleapis');
const { getAuthClient } = require('./gmail-auth');

const TO = ['Piyush Singhal <psinghal@adobe.com>', 'Siddharth Sahni <ssahni@adobe.com>'].join(', ');
const CC = 'Piyush Patel <piyush.patel@algolia.com>';
const SUBJECT = 'Adobe OEM: search usage pacing and the staging trend';

const HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:'Sora',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#36395A">
<div style="max-width:560px;margin:0 auto;padding:22px 24px;font-size:15px;line-height:1.6;color:#36395A">

<p style="margin:0 0 14px">Hi Piyush, Siddharth,</p>

<p style="margin:0 0 16px">I wanted to flag the search consumption trend on the Adobe OEM program early, so it is on our collective radar well ahead of any term true-up. The short version: usage is pacing well above plan this term, and the driver is the Test/Staging parent application.</p>

<p style="margin:18px 0 6px;font-size:11px;font-weight:600;letter-spacing:0.8px;color:#7778AF">BACKGROUND</p>
<ul style="margin:0 0 16px;padding-left:20px">
  <li style="margin-bottom:6px">The current term (Q-47553, Feb 2026 to Jan 2027) carries a combined <strong>75M annual search allocation</strong> across the Production and Test/Staging parent applications.</li>
  <li>Search on the Test/Staging parent (J50O6J0MJP) has been rising steadily and now materially exceeds Production (EX9JOVML7S).</li>
</ul>

<p style="margin:18px 0 8px;font-size:11px;font-weight:600;letter-spacing:0.8px;color:#7778AF">SEARCH CONSUMED BY CONTRACT YEAR</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ebf2;border-radius:6px;font-size:13.5px;color:#36395A;border-collapse:separate;border-spacing:0">
  <tr style="background:#f7f8fc">
    <td style="padding:8px 12px;font-weight:600;font-size:11px;color:#484C7A">Period</td>
    <td style="text-align:right;padding:8px 10px;font-weight:600;font-size:11px;color:#484C7A">Production</td>
    <td style="text-align:right;padding:8px 10px;font-weight:600;font-size:11px;color:#484C7A">Staging</td>
    <td style="text-align:right;padding:8px 12px;font-weight:600;font-size:11px;color:#484C7A">Combined</td>
  </tr>
  <tr style="border-top:1px solid #eef0f4">
    <td style="padding:8px 12px">Year 1 <span style="color:#9698C3">(Feb 24 to Jan 25)</span></td>
    <td style="text-align:right;padding:8px 10px">2.7M</td>
    <td style="text-align:right;padding:8px 10px">4.0M</td>
    <td style="text-align:right;padding:8px 12px;font-weight:600;color:#000033">6.7M</td>
  </tr>
  <tr style="border-top:1px solid #eef0f4;background:#fbfcfe">
    <td style="padding:8px 12px">Year 2 <span style="color:#9698C3">(Feb 25 to Jan 26)</span></td>
    <td style="text-align:right;padding:8px 10px">25.3M</td>
    <td style="text-align:right;padding:8px 10px">34.3M</td>
    <td style="text-align:right;padding:8px 12px;font-weight:600;color:#000033">59.6M</td>
  </tr>
  <tr style="border-top:1px solid #eef0f4">
    <td style="padding:8px 12px">This term <span style="color:#9698C3">(Feb 26 to now, ~5 mo)</span></td>
    <td style="text-align:right;padding:8px 10px">19.9M</td>
    <td style="text-align:right;padding:8px 10px;color:#b4361f;font-weight:600">41.6M</td>
    <td style="text-align:right;padding:8px 12px;font-weight:700;color:#000033">61.5M</td>
  </tr>
</table>
<p style="margin:6px 0 16px;font-size:11px;color:#9698C3">Billable search, excluding query suggestions. Prior term (Y1 to Y2) allocation was ~80M per year; current term is 75M per year.</p>

<p style="margin:18px 0 6px;font-size:11px;font-weight:600;letter-spacing:0.8px;color:#7778AF">THE READ</p>
<ul style="margin:0 0 16px;padding-left:20px">
  <li style="margin-bottom:6px">Staging has out-consumed Production <strong>every contract year</strong>, and the gap is widening. Staging is now roughly 2x Production.</li>
  <li>This term you are at ~61.5M combined in about five months against the 75M annual allocation. That is an annualized pace near <strong>148M, roughly double the quota</strong>. Staging alone accounts for ~41.6M of it.</li>
</ul>

<p style="margin:18px 0 6px;font-size:11px;font-weight:600;letter-spacing:0.8px;color:#7778AF">SUGGESTED NEXT STEP</p>
<p style="margin:0 0 16px">A large share of this sits on the Test/Staging parent. Where that reflects non-production testing, it is worth a look at whether it needs to run at this volume, since it draws on the same allocation. Could we find 30 minutes in the next week or two to walk through the usage together and align on staging practices and capacity for the rest of the term? I will follow up with a couple of times.</p>

<p style="margin:0 0 18px">Full app-level detail is on the <a href="https://oem-usage-dashboard.vercel.app" style="color:#003DFF;text-decoration:none">live dashboard</a>, and I am happy to share the weekly breakdown.</p>

<p style="margin:0 0 2px">Best,</p>
<p style="margin:0;line-height:1.5">Arijit Chowdhury<br>
<span style="color:#7778AF;font-size:13px">Director, Strategic Partnerships</span><br>
<span style="color:#7778AF;font-size:13px">arijit.chowdhury@algolia.com | (312) 420 9767</span></p>

</div></body></html>`;

function buildMime({ to, cc, subject, html }) {
  const lines = [
    `To: ${to}`,
    `Cc: ${cc}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
  ];
  return lines.join('\r\n');
}

(async () => {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = Buffer.from(buildMime({ to: TO, cc: CC, subject: SUBJECT, html: HTML }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const draft = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } });
  console.log('Draft saved. ID:', draft.data.id);
  console.log('To:', TO);
  console.log('Cc:', CC);
  console.log('Subject:', SUBJECT);
  console.log('Review: https://mail.google.com/mail/u/0/#drafts');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
