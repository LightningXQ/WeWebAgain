// loader/busTimetable.js
const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeStopName } = require('../utils/normalize');

// 메모리 저장소: { [routeId]: { week: {byStop, byEdge, rawToNorm}, holi: {...}, sat: {...} } }
const busTimetables = Object.create(null);
function ensureRoute(routeId) {
  if (!busTimetables[routeId]) {
    const empty = () => ({ byStop: new Map(), byEdge: new Map(), rawToNorm: new Map() });
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
  const rid = String(m[1]).trim(); // 필요 시 normalizeBusRouteId(rid)
  return { routeId: rid, dayKey: m[2].toLowerCase() }
}

// "번호,정류소명,05:00,05:11,..." → { stopName, times[] }
function parseLine(line) {
  if (!line) return null;
  const cols = line.trim().split(',');
  if (cols.length < 3) return null;
  const stopName = cols[1].trim();
  const times = cols.slice(2).map(s => s.trim()).filter(Boolean);
  return { stopName, times };
}

const mkEdgeKey = (a, b) => `${normalizeStopName(a)}→${normalizeStopName(b)}`;

async function loadOneCSV(absPath, routeId, dayKey) {
  let raw = await fs.readFile(absPath, 'utf-8');
  // 파일 단위로 BOM 1회 제거
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

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
    bucket.byStop.set(keyNorm, cur.times);           // 정규화 키만 보관
    bucket.rawToNorm.set(keyRaw, keyNorm);           // 원본→정규화 별도 기록

    // byEdge: (현재정류장 → 다음정류장) 엣지 키로 저장 — 방향 포함!
    //        값은 '현재 정류장'에서의 출발 HH:MM 배열입니다.
    if (next) {
      bucket.byEdge.set(mkEdgeKey(cur.stopName, next.stopName), cur.times);
    }
  }
  const uniqStops = new Set(recs.map(r => normalizeStopName(r.stopName))).size;
  console.log(`🚌 loaded ${path.basename(absPath)} → route=${routeId}, day=${dayKey}, stops=${uniqStops}, edges=${bucket.byEdge.size}`);
}

async function loadBusCSVsFromDir(dirAbsPath) {
  const files = (await fs.readdir(dirAbsPath))
    .map(f => ({ meta: parseFileName(f), f }))
    .filter(x => x.meta);
  await Promise.all(
    files.map(({ meta, f }) =>
      loadOneCSV(path.join(dirAbsPath, f), meta.routeId, meta.dayKey)
    )
  );
  return busTimetables;
}

module.exports = { loadBusCSVsFromDir, busTimetables };
