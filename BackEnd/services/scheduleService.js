const axios = require('axios');
const { busTimetables } = require('../loader/bustimetable');
const { normalizeBusRouteId, normalizeLineName, normalizeStopName, dayTypeToBusKey, dayTypeToSubwayKey } = require('../utils/normalize');
const { isWithinServiceHHMM } = require('../utils/time');

// 데이터 소스 스위치: 기본값 'odsay'
const useODsay = (process.env.SUBWAY_SOURCE || 'odsay').toLowerCase() === 'odsay';

// HH:MM 형태로 보정 (예: '5:3' → '05:03', '5:03:00' → '05:03')
function toHHMM(s) {
  const str = String(s || '').trim();
  const m = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/); // H:M, H:MM, HH:MM[:SS]
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}



// ODsay (신) 지하철역 전체 시간표 -> HH:MM 배열 반환
async function getSubwayScheduleByODsay(stationID, wayCode, day) {
  const appKey = (process.env.ODSAY_API_KEY || '').trim();
  if (!appKey) throw new Error('Missing ODSAY_API_KEY');

  // 입력 day -> ODsay weekKey('weekday'|'sat'|'sun')
  function toODsayWeekKey(d) {
    const s = String((typeof d === 'object' && (d.subway || d.bus)) ? (d.subway || d.bus) : d)
      .trim().toLowerCase();
    if (['평일','weekday','week','wd'].includes(s)) return 'weekday';
    if (['토','토요일','sat','saturday'].includes(s)) return 'sat';
    return 'sun'; // 일요일/공휴일
  }
  const weekKey = toODsayWeekKey(day);

  const params = new URLSearchParams({
    apiKey: appKey,           // URLSearchParams가 자동 인코딩
    stationID: String(stationID),
    lang: '0',
  });
  if (wayCode === 1 || wayCode === 2) params.set('wayCode', String(wayCode));

  const url = `https://api.odsay.com/v1/api/searchSubwaySchedule?${params.toString()}`;
  let data;
  try {
    ({ data } = await axios.get(url));
  } catch (e) {
    console.error('❌ ODsay 요청 실패:', e?.response?.status, e?.message);
    return [];
  }

  // (신) API: 평일/토/일 섹션 이름 (일반적 명칭)
  const nodeMap = { weekday: 'weekdaySchedule', sat: 'saturdaySchedule', sun: 'sundaySchedule' };
  let dayNode = data?.result?.[nodeMap[weekKey]];
  if (!dayNode && weekKey === 'sun') {
    // 어떤 계정은 휴일을 holidaySchedule로 내려줌
    dayNode = data?.result?.holidaySchedule || null;
  }
  if (!dayNode) {
    console.warn(`⚠️ ODsay 요일 섹션 없음: weekKey='${weekKey}' node='${nodeMap[weekKey]}'`);
    return [];
  }

  const collect = (dir /* 'up'|'down' */) => {
    const node = dayNode?.[dir];
    if (!node) return [];

    // 케이스 1) 예전(또는 일부 계정) 구조: { time: [ { Idx, list }, ... ] }
    if (Array.isArray(node.time)) {
      const out = [];
      for (const b of node.time) {
        const h = Number(b?.Idx);
        if (!Number.isFinite(h)) continue;
        const hh = ((h % 24) + 24) % 24; // 24→00, 25→01
        const mmList = String(b?.list || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const mm of mmList) out.push(`${String(hh).padStart(2,'0')}:${mm.padStart(2,'0')}`);
      }
      return out;
    }

    // 케이스 2) 새 구조: up/down 자체가 배열
    if (Array.isArray(node)) {
      // 2-1) ["05:03","05:15", ...] 식 문자열 배열
      if (typeof node[0] === 'string') return node.slice();

      // 2-2) [{ time: "05:03" }, ...] 식 객체 배열
      if (node[0] && typeof node[0] === 'object') {
        const out = [];
        for (const item of node) {
          const t = item.time || item.hhmm || item.departureTime || item.t; // 방어적으로 여러 키 시도
          if (t) out.push(String(t));
        }
        return out;
      }
    }

    // 알 수 없는 형태면 빈 배열
    return [];
  };

  const times = [...collect('up'), ...collect('down')]
    .map(toHHMM)
    .filter(Boolean)
    .sort();

  // console.info(`[ODsay] stationID=${stationID} wayCode=${wayCode} week=${weekKey} count=${times.length}`);
  return times;
}


const OD_CLOUD_KEY = (process.env.OD_CLOUD_KEY || '').trim();

// Map 또는 일반 객체에서 키로 안전 조회
function getFromMapOrObj(store, key) {
  if (!store) return undefined;
  if (store instanceof Map) return store.get(key);
  return store[key];
}

// === [추가 시작] 공통/버스 헬퍼 4종 ===

  // ✅ ODCloud API 기반 부산지하철 전체 시간표 (1~4호선 전부) 가져오기
  async function getSubwayScheduleByODCloud(stationName, nextStationName, lineName, subwayKey) {
    const baseUrl = `https://api.odcloud.kr/api/15082980/v1/uddi:f289c185-dd70-46ef-894f-faa0713559c2`;
    const serviceKey = OD_CLOUD_KEY; 

    const allData = [];

    for (let page = 1; page <= 5; page++) {
      const url = `${baseUrl}?serviceKey=${encodeURIComponent(serviceKey)}&page=${page}&perPage=500`;
      try {
        const res = await axios.get(url);
        const curData = res.data?.data || [];
        allData.push(...curData);
        if ((res.data?.currentCount ?? 0) < 500) break;
      } catch (err) {
        console.error("❌ ODCloud 요청 실패:", err.message);
        break;
      }
    }

    function buildAltDayKeys(dayKey) {
      if (dayKey === '토요일') return ['토요일', '공휴일'];   // 주말 합본 데이터 대비
      if (dayKey === '공휴일') return ['공휴일', '토요일'];   // 반대 케이스도
      return [dayKey];                                       // 평일은 그대로
    }
    let filtered = [];
    for (const key of buildAltDayKeys(subwayKey)) {
      filtered = allData.filter(train =>
        normalizeLineName(train.노선명) === normalizeLineName(lineName) &&
        train.요일구분 === key
      );
      if (filtered.length) {
        if (key !== subwayKey) {
          console.warn(`⚠️ ODCloud day fallback used: requested='${subwayKey}' -> used='${key}'`);
        }
        break;
      }
    }

    // 시작역/다음역 이름을 정규화해서 비교
    const wantStart = normalizeStopName(stationName);
    const wantNext  = normalizeStopName(nextStationName);

    const times = [];

    for (const train of filtered) {
      // 역 목록
      const stationListRaw = train.운행구간정거장?.split('+') ?? [];
      const stationList = stationListRaw
        .map(x => x.split('-')[1] ?? '')
        .map(normalizeStopName);

      // 출발/도착 시각 배열 (둘 다 지원)
      const depRaw = train.정거장출발시각?.split('+') ?? [];
      const arrRaw = train.정거장도착시각?.split('+') ?? [];

      const stationTimesDep = depRaw.map(x => x.split('-')[1]).filter(Boolean);
      const stationTimesArr = arrRaw.map(x => x.split('-')[1]).filter(Boolean);

      // 시작역 인덱스 찾기 + 다음역 확인
      const idx = stationList.indexOf(wantStart);
      const isNextOk = (idx !== -1) && (stationList[idx + 1] === wantNext);

      if (!isNextOk) continue;

      // 출발시각이 있으면 우선 사용, 없으면 도착시각으로 대체
      const tRaw = stationTimesDep[idx] || stationTimesArr[idx];
      const t = toHHMM(tRaw);           // ✅ 지하철에만 HH:MM 보정
      if (!t) continue;

      console.info(`[subway] ${lineName} ${stationName}→${nextStationName} push='${tRaw}' -> '${t}'`);

      if (isWithinServiceHHMM(t)) {
        times.push(t);
      }
    }

    return times.sort();
  }

  // 2) (지하철) subPath에서 '다음 역 이름'
  function getNextStopNameFromSubPath(subPath) {
    const list = subPath?.passStopList?.stations?.map(s => s.stationName) || [];
    const start = subPath?.startName;
    const idx = list.indexOf(start);
    if (idx === -1 || idx === list.length - 1) return null;
    return list[idx + 1];
  }

  // 3) (버스) busTimetables에서 출발시각 꺼내기
  function getBusDepartures(routeId, stopName, busKey, { nextName, alsoTryNames = [] } = {}) {
    const bucket = busTimetables[routeId] || busTimetables[routeId + '번'] || null;
    if (!bucket) return [];
    const dayBucket = bucket[busKey];
    if (!dayBucket) return [];
    const byStop = dayBucket.byStop || dayBucket; // (구버전 Map과의 호환)
    const byEdge = dayBucket.byEdge || new Map();

    const raw  = stopName || '';
    const norm = normalizeStopName(raw);

    // 1) 정규화된 이름을 우선, 실패 시 raw
    let arr = null;

    // 0) nextName이 있으면 (stop→next) 엣지로 먼저 조회 — 방향 확정
    if (nextName) {
      const edgeKey = `${normalizeStopName(stopName)}→${normalizeStopName(nextName)}`;
      arr = getFromMapOrObj(byEdge, edgeKey) || null;
    }

    // 1) 엣지에서 못 찾으면 byStop로 폴백(정규화 우선)
    if (!arr) {
      arr = getFromMapOrObj(byStop, norm) ?? getFromMapOrObj(byStop, raw) ?? null;
    }

    // 2) (선택) 보조 후보명들도 정규화해서 시도
    if (!arr && Array.isArray(alsoTryNames)) {
      for (const cand of alsoTryNames) {
        const cNorm = normalizeStopName(cand || '');
        arr = getFromMapOrObj(byStop, cNorm) ?? getFromMapOrObj(byStop, cand) ?? null;
        if (arr) break;
      }
    }

    return Array.isArray(arr) ? arr.filter(isWithinServiceHHMM) : [];
  }

  // 4) (공통) 지하철/버스 출발시각 가져오기
  //(지하철/버스 구간을 자동 판별해 위 두 함수를 호출)
  async function fetchDeparturesForSection(subPath, day) {
    if (subPath.trafficType === 1) {
      // 🚇 지하철
      if (useODsay) {
        const stationID = subPath.startID || subPath.startStationID || subPath.stationID;
        const wayCode   = subPath.wayCode; // 1: 상행, 2: 하행
        if (!stationID) return [];
        return await getSubwayScheduleByODsay(stationID, wayCode, day);
      }

        // (폴백) ODCloud 사용 경로
        const station = subPath.startName;
        const nextStation = getNextStopNameFromSubPath(subPath);
        const lineName = subPath.lane?.[0]?.name;
        if (!station || !nextStation || !lineName) return [];
        const subwayKeyRaw = dayTypeToSubwayKey(day);
        const subwayKey    = (subwayKeyRaw === '휴일') ? '공휴일' : subwayKeyRaw;
        return await getSubwayScheduleByODCloud(station, nextStation, lineName, subwayKey);
      // 🚌 버스 (CSV 파일명 routeId = busNo 권장)
      } else if (subPath.trafficType === 2) {
         // 🚌 버스 (CSV 파일명 routeId = busNo 권장)
      const rawBusNo = subPath.lane?.[0]?.busNo || subPath.lane?.[0]?.busID || '';
      const routeId  = normalizeBusRouteId(rawBusNo);
      const stopName = subPath.startName;
      const nextName = getNextStopNameFromSubPath(subPath); // 방향 판단용 (필수)
      if (!routeId || !stopName) return [];
      const busKey = dayTypeToBusKey(day); // 'week' or 'holi'
      // 1) 시작 정류장 우선
      const timesStart = getBusDepartures(routeId, stopName, busKey, { nextName });
      if (timesStart.length) return timesStart;

      // 2) 시작 정류장이 비어 있을 때만 보조로 시도 (원치 않으면 제거)
      const timesNext = nextName
        ? getBusDepartures(routeId, stopName, busKey, { alsoTryNames: [nextName] })
        : [];
      if (timesNext.length) {
        console.warn('⚠️ BUS timetable fallback to NEXT stop', {
          routeId, start: stopName, next: nextName
        });
      }
      return timesNext;
    }
    return [];
  }

  // === [추가 끝] 공통/버스 헬퍼 4종 ===

  module.exports = { getBusDepartures, getSubwayScheduleByODCloud, fetchDeparturesForSection };
