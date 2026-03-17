#!/usr/bin/env node
/**
 * generate-charts.js — Creates inline SVG charts for wealth reports.
 *
 * Usage:
 *   node generate-charts.js <type> [options]
 *
 * Types:
 *   pie     --data "Equities:42,Fixed Income:28,Alternatives:15,Real Estate:10,Cash:5"
 *   bar     --data "Q1:3.2,Q2:4.1,Q3:2.8,Q4:1.9" [--benchmark "Q1:2.1,Q2:3.0,Q3:2.5,Q4:1.4"]
 *   line    --data "Jan:100,Feb:103,Mar:101,Apr:107,May:110,Jun:108"
 *   donut   --data "Equities:42,Fixed Income:28,Alternatives:15,Real Estate:10,Cash:5"
 *
 * Options:
 *   --title "Chart Title"
 *   --width 500 --height 300
 *   --colors "#0B1F3A,#B8860B,#3C4A5C,#1B6B3A,#D4D8DC"  (comma-separated)
 *   --output chart.svg  (default: stdout)
 *
 * Output is an SVG string. Embed directly in HTML: paste inside the <body>.
 */

const fs = require('fs');

const DEFAULTS = {
  colors: ['#0B1F3A', '#B8860B', '#3C4A5C', '#1B6B3A', '#8B6914', '#6B7B8D', '#8B1A1A', '#2E5090'],
  width: 500,
  height: 300,
  fontFamily: "'Segoe UI', Calibri, sans-serif",
};

function parseData(str) {
  return str.split(',').map(p => {
    const [label, val] = p.split(':');
    return { label: label.trim(), value: parseFloat(val) };
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { type: args[0] };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--data') opts.data = parseData(args[++i]);
    else if (args[i] === '--benchmark') opts.benchmark = parseData(args[++i]);
    else if (args[i] === '--title') opts.title = args[++i];
    else if (args[i] === '--width') opts.width = parseInt(args[++i]);
    else if (args[i] === '--height') opts.height = parseInt(args[++i]);
    else if (args[i] === '--colors') opts.colors = args[++i].split(',');
    else if (args[i] === '--output') opts.output = args[++i];
  }
  return opts;
}

function pieChart(data, opts) {
  const w = opts.width || DEFAULTS.width;
  const h = opts.height || DEFAULTS.height;
  const colors = opts.colors || DEFAULTS.colors;
  const cx = w * 0.35, cy = h * 0.5, r = Math.min(cx, cy) - 20;
  const total = data.reduce((s, d) => s + d.value, 0);
  const isDonut = opts.type === 'donut';

  let paths = '';
  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
    angle += sweep;
  });

  if (isDonut) {
    paths += `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="white"/>`;
  }

  // Legend
  let legend = '';
  const lx = w * 0.72;
  data.forEach((d, i) => {
    const ly = 40 + i * 24;
    const pct = ((d.value / total) * 100).toFixed(1);
    legend += `<rect x="${lx}" y="${ly - 8}" width="12" height="12" rx="1" fill="${colors[i % colors.length]}"/>`;
    legend += `<text x="${lx + 18}" y="${ly + 2}" font-size="10" fill="#1E2A3A" font-family="${DEFAULTS.fontFamily}">${d.label} (${pct}%)</text>`;
  });

  let title = '';
  if (opts.title) {
    title = `<text x="${w/2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#0B1F3A" font-family="${DEFAULTS.fontFamily}">${opts.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;margin:16px auto;">${title}${paths}${legend}</svg>`;
}

function barChart(data, opts) {
  const w = opts.width || DEFAULTS.width;
  const h = opts.height || DEFAULTS.height;
  const colors = opts.colors || DEFAULTS.colors;
  const bench = opts.benchmark;

  const pad = { top: 40, right: 20, bottom: 50, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const allVals = data.map(d => d.value).concat(bench ? bench.map(d => d.value) : []);
  const maxVal = Math.ceil(Math.max(...allVals) * 1.15);
  const barCount = data.length;
  const groupWidth = cw / barCount;
  const barWidth = bench ? groupWidth * 0.35 : groupWidth * 0.6;
  const gap = bench ? groupWidth * 0.05 : 0;

  let bars = '';
  data.forEach((d, i) => {
    const bh = (d.value / maxVal) * ch;
    const x = pad.left + i * groupWidth + (bench ? groupWidth * 0.12 : groupWidth * 0.2);
    const y = pad.top + ch - bh;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${bh}" fill="${colors[0]}" rx="2"/>`;
    bars += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" font-size="9" fill="#0B1F3A" font-family="${DEFAULTS.fontFamily}">${d.value > 0 ? '+' : ''}${d.value}%</text>`;
    // x-axis label
    bars += `<text x="${pad.left + i * groupWidth + groupWidth/2}" y="${h - pad.bottom + 18}" text-anchor="middle" font-size="9" fill="#6B7B8D" font-family="${DEFAULTS.fontFamily}">${d.label}</text>`;

    if (bench && bench[i]) {
      const bh2 = (bench[i].value / maxVal) * ch;
      const x2 = x + barWidth + gap;
      const y2 = pad.top + ch - bh2;
      bars += `<rect x="${x2}" y="${y2}" width="${barWidth}" height="${bh2}" fill="${colors[1]}" rx="2"/>`;
      bars += `<text x="${x2 + barWidth/2}" y="${y2 - 5}" text-anchor="middle" font-size="9" fill="#B8860B" font-family="${DEFAULTS.fontFamily}">${bench[i].value > 0 ? '+' : ''}${bench[i].value}%</text>`;
    }
  });

  // Axes
  let axes = `<line x1="${pad.left}" y1="${pad.top + ch}" x2="${w - pad.right}" y2="${pad.top + ch}" stroke="#D4D8DC" stroke-width="1"/>`;

  // Legend
  let legend = '';
  if (bench) {
    legend += `<rect x="${pad.left}" y="${h - 15}" width="10" height="10" fill="${colors[0]}" rx="1"/>`;
    legend += `<text x="${pad.left + 14}" y="${h - 6}" font-size="9" fill="#1E2A3A" font-family="${DEFAULTS.fontFamily}">Portfolio</text>`;
    legend += `<rect x="${pad.left + 80}" y="${h - 15}" width="10" height="10" fill="${colors[1]}" rx="1"/>`;
    legend += `<text x="${pad.left + 94}" y="${h - 6}" font-size="9" fill="#1E2A3A" font-family="${DEFAULTS.fontFamily}">Benchmark</text>`;
  }

  let title = '';
  if (opts.title) {
    title = `<text x="${w/2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#0B1F3A" font-family="${DEFAULTS.fontFamily}">${opts.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;margin:16px auto;">${title}${axes}${bars}${legend}</svg>`;
}

function lineChart(data, opts) {
  const w = opts.width || DEFAULTS.width;
  const h = opts.height || DEFAULTS.height;
  const colors = opts.colors || DEFAULTS.colors;

  const pad = { top: 40, right: 20, bottom: 50, left: 55 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const vals = data.map(d => d.value);
  const minVal = Math.floor(Math.min(...vals) * 0.95);
  const maxVal = Math.ceil(Math.max(...vals) * 1.05);
  const range = maxVal - minVal || 1;

  let points = [];
  let dots = '';
  let labels = '';
  data.forEach((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - ((d.value - minVal) / range) * ch;
    points.push(`${x},${y}`);
    dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="${colors[0]}" stroke="white" stroke-width="1.5"/>`;
    if (data.length <= 12) {
      labels += `<text x="${x}" y="${h - pad.bottom + 18}" text-anchor="middle" font-size="8.5" fill="#6B7B8D" font-family="${DEFAULTS.fontFamily}">${d.label}</text>`;
    }
  });

  // Grid lines
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * ch;
    const val = maxVal - (i / 4) * range;
    grid += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="#E8E8E8" stroke-width="0.5"/>`;
    grid += `<text x="${pad.left - 8}" y="${y + 3}" text-anchor="end" font-size="8" fill="#6B7B8D" font-family="${DEFAULTS.fontFamily}">${val.toFixed(0)}</text>`;
  }

  // Area fill
  const area = `<polygon points="${pad.left},${pad.top + ch} ${points.join(' ')} ${pad.left + cw},${pad.top + ch}" fill="url(#areaGrad)" opacity="0.3"/>`;
  const gradient = `<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors[0]}" stop-opacity="0.4"/><stop offset="1" stop-color="${colors[0]}" stop-opacity="0.02"/></linearGradient></defs>`;

  const line = `<polyline points="${points.join(' ')}" fill="none" stroke="${colors[0]}" stroke-width="2.5" stroke-linejoin="round"/>`;

  let title = '';
  if (opts.title) {
    title = `<text x="${w/2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#0B1F3A" font-family="${DEFAULTS.fontFamily}">${opts.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;margin:16px auto;">${gradient}${title}${grid}${area}${line}${dots}${labels}</svg>`;
}

// ── Main ──
const opts = parseArgs();
if (!opts.type || !opts.data) {
  console.log(`Usage: node generate-charts.js <pie|donut|bar|line> --data "Label:Value,..." [--title "..."] [--benchmark "..."] [--output file.svg]`);
  process.exit(0);
}

let svg;
switch (opts.type) {
  case 'pie':
  case 'donut':
    svg = pieChart(opts.data, opts);
    break;
  case 'bar':
    svg = barChart(opts.data, opts);
    break;
  case 'line':
    svg = lineChart(opts.data, opts);
    break;
  default:
    console.error(`Unknown chart type: ${opts.type}`);
    process.exit(1);
}

if (opts.output) {
  fs.writeFileSync(opts.output, svg);
  console.log(`✅ ${opts.output}`);
} else {
  console.log(svg);
}
