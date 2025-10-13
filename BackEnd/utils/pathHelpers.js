  const { addMinutesToTime } = require('./time');
  const axios = require('axios');

  // 시간+노선+역”으로 키를 확장해서 정확도를 올릴 때 사용
  // const { normalizeStopName } = require('./normalize'); // 키 확장 쓰면 해제
  

    function getWalkMinutesBetween(subPaths, fromTransitIdx, toTransitIdx, fixedMin=3) {
    const lo = Math.min(fromTransitIdx, toTransitIdx);
    const hi = Math.max(fromTransitIdx, toTransitIdx);
    let sum = 0;

    for (let i = lo + 1; i < hi; i++) {
      const seg  = subPaths[i];
      const prev = subPaths[i - 1];
      const next = subPaths[i + 1];

      // "환승 도보" 판정: 앞/뒤가 대중교통(1|2)이고, 현재 구간이 도보(3)
      const isTransferWalk =
        seg?.trafficType === 3 &&
        prev && (prev.trafficType === 1 || prev.trafficType === 2) &&
        next && (next.trafficType === 1 || next.trafficType === 2);

      if (isTransferWalk) {
        console.log(subPaths, fromTransitIdx, toTransitIdx)
        return fixedMin;
        //sum += seg.sectionTime || 0;
      }
    }
    //return sum;
    return 0;
  }

  function getSectionTimesBefore(subPaths, transferIndex) {
    const times = [];
    for (let i = 0; i < transferIndex; i++) {
      times.push(subPaths[i].sectionTime || 0);
    }
    return times;
  }


  function getXyFromPath(path) {
  // 1. trafficType이 2인 대중교통 구간만 필터링하여 새로운 배열을 만듭니다.
  const transitSections = path.filter(section => section.trafficType === 2);

  // 2. 대중교통 구간이 2개 미만이면(즉, 환승이 없으면) null을 반환합니다.
  if (transitSections.length < 2) {
    console.error("환승 정보를 추출할 수 없습니다. 대중교통 구간이 2개 미만입니다.");
    return null;
  }

  // 3. 첫 번째 대중교통 구간과 두 번째 대중교통 구간의 정보를 가져옵니다.
  const firstTransitSection = transitSections[0];
  const secondTransitSection = transitSections[1];

  // 4. 첫 번째 구간에서는 end 좌표를, 두 번째 구간에서는 start 좌표를 추출하여
  //    하나의 객체로 조합한 후 반환합니다.
  return {
    sx: firstTransitSection.endX,
    sy: firstTransitSection.endY,
    ex: secondTransitSection.startX,
    ey: secondTransitSection.startY,
  };
}

  async function getWalkTime(path, fromTransitIdx, toTransitIdx) { //도보환승시간 계산
  const TMAP_APP_KEY = 'WhGcxVojKO7g0CL8lD1NYgw2TiEf2r25qFNDUpOd'; 
  const url = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';

  const {sx, sy, ex, ey} = getXyFromPath(path);

  try {
    // 1. Tmap API에 POST 방식으로 요청을 보냅니다.
    const response = await axios.post(
      url,
      // 2. 요청 시 본문(payload)에 포함될 데이터입니다.
      {
        startX: sx,           // 출발지 X좌표(경도)
        startY: sy,           // 출발지 Y좌표(위도)
        endX: ex,             // 도착지 X좌표(경도)
        endY: ey,             // 도착지 Y좌표(위도)
        reqCoordType: "WGS84GEO", // 좌표계 타입 설정
        startName: "출발지",      // 출발지 이름
        endName: "도착지"       // 도착지 이름
      },
      // 3. 요청 헤더에는 인증을 위한 API 키를 포함합니다.
      {
        headers: {
          'appKey': TMAP_APP_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // 4. API 응답 데이터에서 필요한 정보를 추출합니다.
    //    (총 시간, 총 거리는 features 배열의 첫 번째 요소 안에 있습니다.)
    const properties = response.data.features[0].properties;

    const totalTimeInSeconds = properties.totalTime;       // 총 소요 시간 (초 단위)
    const totalDistanceInMeters = properties.totalDistance; // 총 이동 거리 (미터 단위)

    // 5. 추출한 정보를 콘솔에 알아보기 쉽게 출력합니다.
    console.log(`\n🕒 총 소요 시간: ${totalTimeInSeconds}초 (${Math.ceil(totalTimeInSeconds / 60)}분)`);
    console.log(`📏 총 이동 거리: ${totalDistanceInMeters}m`);
    
    // 6. 총 시간과 총 거리만 담은 새로운 JSON 객체를 반환합니다.
    return {
      totalTime: totalTimeInSeconds,
      totalDistance: totalDistanceInMeters,
    };

  } catch (error) {
    // 7. API 호출 중 에러가 발생하면 , 에러 메시지를 콘솔에 출력합니다.
    console.error('❌ Tmap API 호출 오류:', error.response ? error.response.data : error.message);
    
    // 8. 에러 발생 시, null 값을 가진 기본 객체를 반환하여 프로그램 중단을 방지합니다.
    return {
      totalTime: null,
      totalDistance: null,
    };
  }
}

  function getSectionTimesAfter(subPaths, transferIndex) {
    const times = [];
    for (let i = transferIndex + 1; i < subPaths.length; i++) {
      times.push(subPaths[i].sectionTime || 0);
    }
    return times;
  }

  // ===== [환승 사이 도보(trafficType===3) 합계] =====
  // fromTransitIdx / toTransitIdx 는 subPaths 기준의 "대중교통 구간" 인덱스가 아니라
  // subPaths의 실제 인덱스를 넣어야 함 (ex: 버스 — 도보 — 지하철이면 버스/지하철의 subPaths 인덱스)
  


  

  //행렬을 행-열 뒤집어서 세로 → 가로로, 가로 → 세로로 바꿔준다
  function transpose(matrix) {
    if (matrix.length === 0) return [];
    return matrix[0].map((_, colIndex) =>
      matrix.map(row => row[colIndex])
    );
  }

  // ===== [이진탐색 헬퍼] =====
  // arr: 오름차순 정렬된 "분(minute) 값" 배열 (Number[])
  // 1) target 이하(≤)의 최댓값 인덱스 (없으면 -1)
  function idxLE(arr, target){
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= target) { ans = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    return ans;
  }
  // 2) target 이상(≥)의 최솟값 인덱스 (없으면 -1)
  function idxGE(arr, target){
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] >= target) { ans = mid; hi = mid - 1; }
      else { lo = mid + 1; }
    }
    return ans;
  }

  /**
   * 같은 출발/도착 키 안에서 waitMinutes 최솟값만 남기고,
   * 반환 직전에 키 기준(시간) 정렬을 보장한다.
   */
  function getUniqueMinWaitsSorted(pairs, useFromAsKey) {
    const bestMap = new Map();

    for (const pair of (pairs || [])) {
      if (!pair) continue;
      // --- [선택] 키 확장 버전 (노선/역까지 포함하고 싶으면 사용) ---
      // const key = useFromAsKey
      //   ? `${pair.from}|${pair.fromLine||''}|${(pair.fromStation||'').replace(/\s+/g,'')}`
      //   : `${pair.to}|${pair.toLine||''}|${(pair.toStation||'').replace(/\s+/g,'')}`;

      // --- [기본] 시간만 키로 사용 ---
      const key = useFromAsKey ? (pair.from || '') : (pair.to || '');
      if (!key) continue; // 키가 비면 스킵

      const existing = bestMap.get(key);
      if (!existing || pair.waitMinutes < existing.waitMinutes) {
        bestMap.set(key, pair);
      }
    }

    const out = Array.from(bestMap.values());
    out.sort((a, b) =>
      (useFromAsKey ? (a.from || '') : (a.to || ''))
        .localeCompare(useFromAsKey ? (b.from || '') : (b.to || ''))
    );
    return out;
  }

  /**
   * 3구간(환승 2번)에서 첫 환승군과 두 번째 환승군을
   * "expectedFrom = secondBoardAt + (두 번째 대중교통 주행시간)" 기준으로 매칭해
   * groupedTransfers를 만든다. 두 번째 군은 realFrom 기준으로 소비형 매칭.
   */
  function buildGroupedTransfersForThreeLegs(transformed, subPaths) {
    const firstGroup  = transformed?.[0] || [];
    const secondGroup = transformed?.[1] || [];

    // 대중교통 구간 인덱스 추출(1|2)
    const transitIdxs = (subPaths || [])
      .map((p, idx) => ({ p, idx }))
      .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
      .map(x => x.idx);

    // 1→2→3 중 "2"번째 대중교통 구간 시간
    const secondTransitIdx = transitIdxs?.[1];
    const secondTransitDur = subPaths?.[secondTransitIdx]?.sectionTime || 0;

    // 두 번째 군을 realFrom 기준 오름차순 정렬 후 "소비"하며 매칭
    const sg = (secondGroup || [])
      .filter(t => !!t?.realFrom)
      .slice()
      .sort((a, b) => (a.realFrom || '').localeCompare(b.realFrom || ''));
    const used = new Array(sg.length).fill(false);

    function findAndConsume(realFromThreshold) {
      for (let i = 0; i < sg.length; i++) {
        if (used[i]) continue;
        const cand = sg[i];
        if (!cand?.realFrom) continue;
        if (cand.realFrom >= realFromThreshold) {
          used[i] = true;
          return cand;
        }
      }
      return null;
    }

    return firstGroup.map((t1) => {
      // 첫 군의 "두 번째 구간 탑승시각" + 두 번째 구간 주행시간 = 2구간 하차 expectedFrom
      const expectedFrom = addMinutesToTime(t1.secondBoardAt, secondTransitDur);
      const t2 = findAndConsume(expectedFrom);
      return { transfer1: t1, transfer2: t2 };
    });
  }


  module.exports = {
  getSectionTimesBefore,
  getSectionTimesAfter,
  getWalkMinutesBetween,
  transpose,
  // 새로 추가:
  getUniqueMinWaitsSorted,
  buildGroupedTransfersForThreeLegs,
  idxLE,
  idxGE,
  getWalkTime
  };

