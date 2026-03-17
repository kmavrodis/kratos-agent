#!/usr/bin/env node
/**
 * generate-pdf.js — Renders an HTML file to PDF using Playwright Chromium.
 *
 * Usage:
 *   node generate-pdf.js <input.html> [output.pdf] [--format A4|Letter] [--landscape]
 *
 * Requirements: Node.js ≥18, Playwright with Chromium
 *   Install: npx -y playwright install chromium
 *
 * Environment overrides:
 *   PDF_MARGIN_TOP, PDF_MARGIN_BOTTOM, PDF_MARGIN_LEFT, PDF_MARGIN_RIGHT (CSS units)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log('Usage: node generate-pdf.js <input.html> [output.pdf] [--format A4|Letter] [--landscape]');
    process.exit(0);
  }

  const flags = new Set(args.filter(a => a.startsWith('--')).map(a => a.toLowerCase()));
  const positional = args.filter(a => !a.startsWith('--'));
  const formatIdx = args.findIndex(a => a === '--format');

  const input = path.resolve(positional[0]);
  const format = formatIdx !== -1 ? args[formatIdx + 1] : 'A4';
  const landscape = flags.has('--landscape');
  const output = positional[1] ? path.resolve(positional[1]) : input.replace(/\.html?$/i, '.pdf');

  const margin = {
    top:    process.env.PDF_MARGIN_TOP    || '1.8cm',
    bottom: process.env.PDF_MARGIN_BOTTOM || '1.8cm',
    left:   process.env.PDF_MARGIN_LEFT   || '1.5cm',
    right:  process.env.PDF_MARGIN_RIGHT  || '1.5cm',
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto(`file://${input}`, { waitUntil: 'networkidle' });
  await page.pdf({ path: output, format, landscape, margin, printBackground: true });
  await browser.close();

  const size = (fs.statSync(output).size / 1024).toFixed(0);
  console.log(`✅ ${output} (${size} KB)`);
})().catch(err => { console.error('❌', err.message); process.exit(1); });
