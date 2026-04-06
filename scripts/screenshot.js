#!/usr/bin/env node
/**
 * Captures a mobile-friendly screenshot of the Executive Summary
 * from the /email route (no header, no tabs, clean content only).
 *
 * Saves to data/tab1-screenshot.png
 * Requires: dev server running on localhost:3000
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUTPUT = path.resolve(__dirname, '..', 'data', 'tab1-screenshot.png');
const URL = 'http://localhost:3000/email';

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Mobile-friendly width for email readability
  await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 2 });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for charts to render
  await new Promise(r => setTimeout(r, 3000));

  // Add a small date header at the top
  await page.evaluate(() => {
    const body = document.querySelector('.body');
    if (body) {
      const dateEl = document.createElement('div');
      dateEl.style.cssText = 'text-align:center;padding:8px 0 12px;color:#7778AF;font-size:12px;font-weight:500;letter-spacing:0.5px;';
      const meta = document.querySelector('.header-date-val');
      dateEl.textContent = 'Data as of ' + (meta ? meta.textContent : new Date().toLocaleDateString());
      body.insertBefore(dateEl, body.firstChild);
    }
  });

  // Screenshot the entire page content, trimmed to actual height
  // The /email page has no header/tabs, just content
  const contentHeight = await page.evaluate(() => {
    return document.body.scrollHeight;
  });
  await page.setViewport({ width: 420, height: contentHeight, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: OUTPUT, fullPage: false, omitBackground: false });

  await browser.close();

  const size = fs.statSync(OUTPUT).size;
  console.log(`Screenshot saved: ${OUTPUT} (${(size / 1024).toFixed(0)} KB)`);
  return OUTPUT;
}

if (require.main === module) {
  capture().catch(err => {
    console.error('Screenshot failed:', err.message);
    process.exit(1);
  });
}

module.exports = { capture };
