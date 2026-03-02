#!/usr/bin/env node
/**
 * parse-clockify.mjs
 * Convierte un export CSV detallado de Clockify → data/clockify-entries.json
 *
 * Uso:
 *   node scripts/parse-clockify.mjs "ruta/al/export.csv"
 *
 * El JSON generado se importa en nexus-backlog.jsx para pre-cargar
 * el InformePane sin necesidad de subir el CSV manualmente.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('❌  Uso: node scripts/parse-clockify.mjs "ruta/al/export.csv"');
  process.exit(1);
}

// ── CSV parser (mismo algoritmo que parseClockifyCSV en la app) ──────────────
function parseCSVRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function col(headers, names) {
  for (const n of names) {
    const i = headers.findIndex(h => h.includes(n));
    if (i !== -1) return i;
  }
  return -1;
}

function parseDuration(durH) {
  const parts = durH.split(':').map(Number);
  return (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
}

// ── Read file ─────────────────────────────────────────────────────────────────
const text = readFileSync(csvPath, 'utf8');
const lines = text.trim().split(/\r?\n/);
if (lines.length < 2) { console.error('❌  CSV vacío o sin datos'); process.exit(1); }

const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

const iUser    = col(rawHeaders, ['user', 'usuario']);
const iEmail   = col(rawHeaders, ['email']);
const iProject = col(rawHeaders, ['project', 'proyecto']);
const iTags    = col(rawHeaders, ['tags', 'etiquetas', 'tag']);
const iDurH    = col(rawHeaders, ['duration (h)', 'duración (h)', 'duracion (h)']);
const iDurDec  = col(rawHeaders, ['duration (decimal)', 'decimal']);
const iStart   = col(rawHeaders, ['start date', 'fecha inicio']);
const iDesc    = col(rawHeaders, ['description', 'descripción']);

const entries = [];
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const row = parseCSVRow(lines[i]);

  const user    = iUser    >= 0 ? row[iUser]    || '' : '';
  const email   = iEmail   >= 0 ? (row[iEmail]  || '').toLowerCase().trim() : '';
  const project = iProject >= 0 ? (row[iProject]|| '').toLowerCase().trim() : '';
  const tags    = iTags    >= 0 ? row[iTags]    || '' : '';
  const durDec  = iDurDec  >= 0 ? parseFloat(row[iDurDec]) || 0 : 0;
  const durH    = iDurH    >= 0 ? row[iDurH]    || '0:00:00' : '0:00:00';
  const date    = iStart   >= 0 ? (row[iStart]  || '').slice(0, 10) : '';
  const desc    = iDesc    >= 0 ? row[iDesc]    || '' : '';

  let hours = durDec;
  if (!hours) hours = parseDuration(durH);
  if (!hours) { skipped++; continue; }

  // Try to match NX task ID from tags or description (NX-S1.1, NX-S1.01, NX-S2.3…)
  const combined = tags + ' ' + desc;
  const match = combined.match(/NX-S([1-3])\.(\d{1,3})/i);
  // Normalise to 2-digit task number to match BACKLOG_MAP keys (NX-S1.01, NX-S1.10…)
  const taskId = match
    ? `NX-S${match[1]}.${match[2].padStart(2, '0')}`
    : null;

  // Compact entry: u=user, e=email, p=project, h=hours, d=date, t=taskId
  const entry = { u: user, e: email, p: project, h: +hours.toFixed(4), d: date };
  if (taskId) entry.t = taskId;
  entries.push(entry);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const byProject = {};
entries.forEach(e => { byProject[e.p] = (byProject[e.p] || 0) + e.h; });
const tagged = entries.filter(e => e.t).length;

console.log(`✅  ${entries.length} entradas procesadas (${skipped} sin duración omitidas)`);
console.log(`   Por proyecto: ${Object.entries(byProject).map(([p, h]) => `${p.toUpperCase()}=${h.toFixed(1)}h`).join(' | ')}`);
console.log(`   Con tag NX: ${tagged}`);

// ── Write JSON ────────────────────────────────────────────────────────────────
const out = {
  fetchedAt: new Date().toISOString(),
  sourceFile: path.basename(csvPath),
  totalEntries: entries.length,
  entries,
};

const outPath = path.join(ROOT, 'data', 'clockify-entries.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`   Guardado en: ${outPath}  (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
