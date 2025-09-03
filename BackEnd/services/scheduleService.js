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

    // 기존처럼 최대 5페이지만 조회
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
  function getBusDepartures(routeId, stopName, busKey) {
    const bucket = busTimetables[routeId] || busTimetables[routeId + '번'] || null;
    if (!bucket) return [];
    const arr = bucket[busKey]?.get(stopName) || [];
    return arr.filter(isWithinServiceHHMM);
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
      if (!routeId || !stopName) return [];
      const busKey = dayTypeToBusKey(day); // 'week' or 'holi'
      return getBusDepartures(routeId, stopName, busKey);
    }
    return [];
  }

  // === [추가 끝] 공통/버스 헬퍼 4종 ===

  module.exports = { getBusDepartures, getSubwayScheduleByODCloud, fetchDeparturesForSection };
