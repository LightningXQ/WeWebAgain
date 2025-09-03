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

  module.exports = {
  getSectionTimesBefore,
  getSectionTimesAfter,
  getWalkMinutesBetween,
  transpose,
};

