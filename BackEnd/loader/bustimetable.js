// loader/busTimetable.js
const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeStopName } = require('../utils/normalize');

// 메모리 저장소: { [routeId]: { week: Map, holi: Map, sat: Map } }
const busTimetables = Object.create(null);
function ensureRoute(routeId) {
  if (!busTimetables[routeId]) {
    const empty = () => ({ byStop: new Map(), byEdge: new Map() });
    busTimetables[routeId] = { week: empty(), holi: empty(), sat: empty() };
  }
  return busTimetables[routeId];
}

// "2_week.csv" → { routeId:"2", dayKey:"week" }
function parseFileName(file) {
  const { name, ext } = path.parse(file);
  if (ext.toLowerCase() !== '.csv') return null;
  const m = name.match(/^(.+)[-_](week|holi|sat)$/i);
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

const mkEdgeKey = (a, b) => `${normalizeStopName(a)}→${normalizeStopName(b)}`;

async function loadOneCSV(absPath, routeId, dayKey) {
  const raw = await fs.readFile(absPath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  // 먼저 전행을 파싱해 배열로 만든 뒤, (현재, 다음) 쌍을 만든다
  const recs = [];
  for (let i = 1; i < lines.length; i++) {
    const rec = parseLine(lines[i]);
    if (rec) recs.push(rec);
  }
  const bucket = ensureRoute(routeId)[dayKey];
  for (let i = 0; i < recs.length; i++) {
    const cur  = recs[i];
    const next = recs[i + 1]; // CSV 상 인접행 = 노선 상 '다음 정류장'(왕복도 자연스레 포함)

    // byStop: 정규화/원본 둘 다 접근 가능하게 저장(덮어쓰기돼도 byEdge가 정답을 줄 것)
    const keyRaw  = cur.stopName;
    const keyNorm = normalizeStopName(keyRaw);
    bucket.byStop.set(keyNorm, cur.times);
    if (!bucket.byStop.has(keyRaw)) bucket.byStop.set(keyRaw, cur.times);

    // byEdge: (현재정류장 → 다음정류장) 엣지 키로 저장 — 방향 포함!
    if (next) {
      bucket.byEdge.set(mkEdgeKey(cur.stopName, next.stopName), cur.times);
    }
  }
  console.log(`🚌 loaded ${path.basename(absPath)} → route=${routeId}, day=${dayKey},
  stops=${ensureRoute(routeId)[dayKey].byStop.size}, edges=${ensureRoute(routeId)[dayKey].byEdge.size}`);
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
