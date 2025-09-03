// loader/busTimetable.js
const fs = require('node:fs/promises');
const path = require('node:path');

// 메모리 저장소: { [routeId]: { week: Map, holi: Map, sat: Map } }
const busTimetables = Object.create(null);
function ensureRoute(routeId) {
  if (!busTimetables[routeId]) {
    busTimetables[routeId] = { week: new Map(), holi: new Map(), sat: new Map() };
  }
  return busTimetables[routeId];
}

// "2_week.csv" → { routeId:"2", dayKey:"week" }
function parseFileName(file) {
  const { name, ext } = path.parse(file);
  if (ext.toLowerCase() !== '.csv') return null;
  const m = name.match(/^(\w+)[-_](week|holi|sat)$/i);
  if (!m) return null;
  return { routeId: String(m[1]), dayKey: m[2].toLowerCase() }; // week|holi|sat
}

// "번호,정류소명,05:00,05:11,..." → { stopName, times[] }
function parseLine(line) {
  if (!line) return null;
  if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1); // BOM 제거
  const cols = line.trim().split(',');
  if (cols.length < 3) return null;
  const stopName = cols[1].trim();
  const times = cols.slice(2).map(s => s.trim()).filter(Boolean);
  return { stopName, times };
}

async function loadOneCSV(absPath, routeId, dayKey) {
  const raw = await fs.readFile(absPath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i++) { // 0행은 헤더
    const rec = parseLine(lines[i]);
    if (!rec) continue;
    ensureRoute(routeId)[dayKey].set(rec.stopName, rec.times);
  }
  console.log(`🚌 loaded ${path.basename(absPath)} → route=${routeId}, day=${dayKey}, stops=${ensureRoute(routeId)[dayKey].size}`);
}

async function loadBusCSVsFromDir(dirAbsPath) {
  const files = await fs.readdir(dirAbsPath);
  for (const file of files) {
    const meta = parseFileName(file);
    if (!meta) continue;
    await loadOneCSV(path.join(dirAbsPath, file), meta.routeId, meta.dayKey);
  }
  return busTimetables;
}

module.exports = { loadBusCSVsFromDir, busTimetables };
