  
  const { addMinutesToTime } = require('./time');
  // 시간+노선+역”으로 키를 확장해서 정확도를 올릴 때 사용
  // const { normalizeStopName } = require('./normalize'); // 키 확장 쓰면 해제
  
  function getSectionTimesBefore(subPaths, transferIndex) {
    const times = [];
    for (let i = 0; i < transferIndex; i++) {
      times.push(subPaths[i].sectionTime || 0);
    }
    return times;
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
  
  //fixedMin = 3 -> 고정 환승통로시간
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
        return fixedMin;
        //sum += seg.sectionTime || 0;
      }
    }
    //return sum;
    return 0;
  }
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
  };

