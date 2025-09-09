const axios = require('axios');
const { busTimetables } = require('../loader/bustimetable');
const { normalizeBusRouteId, normalizeLineName, normalizeStopName, dayTypeToBusKey, dayTypeToSubwayKey } = require('../utils/normalize');
const { isWithinServiceHHMM } = require('../utils/time');

const OD_CLOUD_KEY = (process.env.OD_CLOUD_KEY || '').trim();

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

    // 노선명 / 요일 일치하는 데이터만 추출
    const filtered = allData.filter(train =>
      normalizeLineName(train.노선명) === normalizeLineName(lineName) &&
      train.요일구분 === subwayKey
    );

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
      const t = stationTimesDep[idx] || stationTimesArr[idx];
      if (!t) continue;

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
      arr = byEdge.get(edgeKey) || null;
    }

    // 1) 엣지에서 못 찾으면 byStop로 폴백(정규화 우선)
    if (!arr) {
      arr = byStop.get(norm) || byStop.get(raw) || null;
    }

    // 2) (선택) 보조 후보명들도 정규화해서 시도
    if (!arr && Array.isArray(alsoTryNames)) {
      for (const cand of alsoTryNames) {
        const cNorm = normalizeStopName(cand || '');
        arr = byStop.get(cNorm) || byStop.get(cand) || null;
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
      const station = subPath.startName;
      const nextStation = getNextStopNameFromSubPath(subPath);
      const lineName = subPath.lane?.[0]?.name;
      if (!station || !nextStation || !lineName) return [];
      const subwayKey = dayTypeToSubwayKey(day);
      return await getSubwayScheduleByODCloud(station, nextStation, lineName, subwayKey);
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
