const { searchPath } = require('./pathService');
const { fetchDeparturesForSection } = require('./scheduleService');
const { getSectionTimesBefore, getSectionTimesAfter, getWalkMinutesBetween, transpose, idxLE, idxGE, getUniqueMinWaitsSorted } = require('../utils/pathHelpers');
const { toMin, toTime, isWithinServiceMin, addMinutesToTime, subtractMinutesFromTime, SERVICE_START_MIN, SERVICE_END_MIN } = require('../utils/time');
const { normalizeBusRouteId, normalizeStopName } = require('../utils/normalize');

const MAX_TRANSFER_WAIT_MIN = 100; // 이 값 초과하는 환승은 버림

// ===== 환승 버퍼 규칙 =====
// - bus 포함: 실제 도보시간(getWalkMinutesBetween) 사용
// [수정됨] FIXED_TRANSFER_CORRIDOR_MIN 상수 제거

function sumActualWalkBetween(subPaths, idxA, idxB) {
  if (!Array.isArray(subPaths) || idxA == null || idxB == null) return 0;
  const [lo, hi] = idxA < idxB ? [idxA + 1, idxB] : [idxB + 1, idxA];
  let total = 0;
  for (let i = lo; i < hi; i++) {
    const seg = subPaths[i];
    // 실제 도보만 합산 (환승통로 time=0 같은 건 제외)
    if (seg?.trafficType === 3 && Number(seg.sectionTime) > 0) {
      total += Number(seg.sectionTime);
    }
  }
  return total;
}

// [수정됨] computeTransferBufferMin 함수: 모든 환승에 실제 도보 시간을 적용하도록 통일
async function computeTransferBufferMin(subPaths, idxA, idxB) {
    // 1) Tmap 기반 '실제 도보'를 우선 적용 (표시/요약과 동일한 기준)
    const sec = await getWalkMinutesBetween(subPaths, idxA, idxB); // 초
    const tmapMin = Math.max(0, Math.ceil(sec / 60));              // 분(올림)
    if (Number.isFinite(tmapMin) && tmapMin > 0) return tmapMin;

    // 2) 실패/0초면, ODsay 섹션타임(실제 도보 세그먼트 합)으로 폴백
    const sumMin = sumActualWalkBetween(subPaths, idxA, idxB);
    return Number.isFinite(sumMin) ? sumMin : 0;
}

// === dedupe helpers ===
// 같은 키 값 그룹에서 waitMinutes가 가장 작은 것 남김(동률이면 to가 더 이른 것)
function dedupeByKeyMin(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    const ex = m.get(k);
    if (!ex) { m.set(k, x); continue; }
    if (x.waitMinutes < ex.waitMinutes) { m.set(k, x); continue; }
    if (x.waitMinutes === ex.waitMinutes) {
      // 시간 문자열 비교(사전식으로도 HH:MM이면 정상 동작)
      const toX = x.to ?? '';
      const toE = ex.to ?? '';
      if (toX < toE) m.set(k, x);
    }
  }
  return Array.from(m.values());
}

function sortByKeyTime(arr, keyFn) {
  // keyFn이 HH:MM 반환이라면 toMin으로 안정적 정렬
  return arr.slice().sort((p, q) => toMin(keyFn(p)) - toMin(keyFn(q)));
}


// ===== [중간구간 드라이버 빌더] =====
// prev(구간1) → mid(구간2) @fromStation : driver = mid 출발(depMid_at_from)
function buildPairs_Prev_to_Mid_using_MidDep(arrPrev_at_from, depMid_at_from, walk12_min){
  const A = arrPrev_at_from.map(toMin).sort((a,b)=>a-b);
  const D = depMid_at_from.map(toMin).sort((a,b)=>a-b);
  const out = [];
  for(const d of D){
    const need = d - walk12_min;             // a ≤ d - walk
    const i = idxLE(A, need);
    if(i === -1) continue;
    const a = A[i];
    const wait = d - (a + walk12_min);
    if(wait < 0) continue;
    if (wait > MAX_TRANSFER_WAIT_MIN) continue; // ⬅️ 초과 후보 제거
    out.push({
      // UI/후속 계산 호환 필드들
      from: toTime(d),            // (첫 환승에서) 기준 키: mid 출발
      to:   toTime(d),
      waitMinutes: wait,
      firstBoardAt:  toTime(a - (0)),   // 실제 첫구간 탑승시는 transformT에서 보정
      firstAlightAt: toTime(a),
      secondBoardAt: toTime(d),
      // secondAlightAt 은 transformT에서 보정 가능
      fromLine: null, fromStation: null, toLine: null, toStation: null,
    });
  }
  return out;
}

// mid(구간2) → next(구간3) @toStation : driver = mid 도착(arrMid_at_to)
function buildPairs_Mid_to_Next_using_MidArr(arrMid_at_to, depNext_at_to, walk23_min){
  const R = arrMid_at_to.map(toMin).sort((a,b)=>a-b);
  const B = depNext_at_to.map(toMin).sort((a,b)=>a-b);
  const out = [];
  for(const r of R){
    const earliest = r + walk23_min;         // b ≥ r + walk
    const j = idxGE(B, earliest);
    if(j === -1) continue;
    const b = B[j];
    const wait = b - earliest;
    if(wait < 0) continue;
    if (wait > MAX_TRANSFER_WAIT_MIN) continue; // ⬅️ 초과 후보 제거
    out.push({
      // UI/후속 계산 호환 필드들
      from: toTime(r),            // (두번째 환승에서) 기준 키: mid 도착
      to:   toTime(b),
      waitMinutes: wait,
      // 첫/두번째 탑승/하차는 transformT에서 보정
      firstBoardAt:  null,
      firstAlightAt: toTime(r),   // ✅ 3호선 '하차'(=도착 r) 시각을 채운다
      secondBoardAt: toTime(b),
      secondAlightAt: null,
      fromLine: null, fromStation: null, toLine: null, toStation: null,
      realFrom: toTime(r)         // 매칭 때 사용할 수 있도록 남김
    });
  }
  return out;
}

    // [수정됨] getAllMinWaitPairs 함수: 환승 도보 버퍼(walkBufferMin)를 포함해서 1:1 매칭
    // scheduleA: 첫 구간 출발표, scheduleB: 두 번째 구간 출발표
    // walkBufferMin: 환승 사이 실제 도보 시간(분) - 이 시간 이후의 B 중 가장 이른 것 선택
    function getAllMinWaitPairs(scheduleA, scheduleB, fromSection, toSection, walkBufferMin = 0) {
    const aMinutes = scheduleA.map(toMin);
    const bMinutes = scheduleB.map(toMin);

    const results = [];
    for (let i = 0; i < aMinutes.length; i++) {
        const aTime = aMinutes[i];

        const sectionTimeA = fromSection?.sectionTime || 0;
        const sectionTimeB = toSection?.sectionTime || 0;

        // 1) 첫 구간 하차 시각(플랫폼 도착 시각)
        const baseAlight = aTime + sectionTimeA;

        // 2) 도보까지 포함한 후, 실제로 두 번째 구간을 탈 수 있는 최소 시각
        const earliestBoard = baseAlight + (walkBufferMin || 0);

        // 플랫폼 도착 시각 서비스 윈도우 체크
        if (!isWithinServiceMin(baseAlight)) continue;

        // 3) earliestBoard 이후의 B 중 가장 빠른 것
        const bMatch = bMinutes.find(bTime => bTime >= earliestBoard);
        if (bMatch === undefined) continue;

        // B 출발이 서비스 윈도우 안인지 확인
        if (!isWithinServiceMin(bMatch)) continue;

        // 4) "도보를 다 포함한 뒤 남는 순수 대기시간"
        const waitMinutes = bMatch - earliestBoard;

        // 새로 계산할 4개 시각(모두 "HH:MM" 문자열)
        const firstBoardAt   = toTime(aTime);
        const firstAlightAt  = toTime(baseAlight);           // 플랫폼 도착
        const secondBoardAt  = toTime(bMatch);               // 두 번째 구간 탑승
        const secondAlightAt = toTime(bMatch + sectionTimeB);

        results.push({
        from: firstAlightAt,   // 첫 구간 하차 시각
        to:   secondBoardAt,   // 두 번째 구간 탑승 시각
        waitMinutes,           // 도보 이후 남는 순수 대기 시간

        fromLine: fromSection?.subwayCode || null,
        fromStation: fromSection.endName,
        toLine: toSection?.subwayCode || null,
        toStation: toSection.startName,

        firstBoardAt,
        firstAlightAt,
        secondBoardAt,
        secondAlightAt
        });
    }

    return results;
    }



  //대기시간 목록 중에 중복 출발(or 도착) 제거하고 대기 시간이 가장 짧은 쌍만 남김
  function getUniqueMinWaits(pairs, useFromAsKey) {
    const bestMap = new Map();

    for (const pair of pairs) {
      const key = useFromAsKey ? pair.from : pair.to;
      const existing = bestMap.get(key);

      if (!existing || pair.waitMinutes < existing.waitMinutes) {
        bestMap.set(key, pair);
      }
    }

    return Array.from(bestMap.values());
  }

  //환승셋 구성(2구간/3구간 케이스 처리 + 도보시간 차감)

  /**
   * get-root의 환승대기시간 로직을 통째로 함수화
   *
   * @param {Array} result - 지하철 구간 목록
   * @returns {Promise<Array>} transfers
   */
  async function getRootTransfers(result, day, subPaths) {
    let allTransfers = [];
    let dep2 = [];  

    if (result.length === 2) {

        const dep1 = await fetchDeparturesForSection(result[0].subPath, day);
        dep2       = await fetchDeparturesForSection(result[1].subPath, day);

        console.log("🔁 dep1 count:", dep1.length);
        console.log("🔁 dep2 count:", dep2.length);
        console.log("🚇 dep2(지하철) sample:", dep2.slice(0,5));

        // dep1, dep2 받은 직후에 추가
        const ok1 = Array.isArray(dep1) && dep1.length > 0;
        const ok2 = Array.isArray(dep2) && dep2.length > 0;
        const timetableCandidate = ok1 && ok2;

        // ✅ 첫 번째 구간이 버스일 때, 시작/다음 정류장과 샘플 시간 확인 (기존 코드 유지)
        if (result[0].subPath?.trafficType === 2) {
        const sp = result[0].subPath;
        const list = sp?.passStopList?.stations?.map(s => s.stationName) || [];
        const start = sp?.startName;
        const idx = list.indexOf(start);
        const next = (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null;

        console.log('🚌 dep1(first bus) @START', {
            route: normalizeBusRouteId(sp?.lane?.[0]?.busNo || sp?.lane?.[0]?.busID || ''),
            start,
            next,
            count: dep1.length,
            sample: dep1.slice(0, 5)
        });
        }

        // ✅ 원본 subPaths에서 실제 대중교통 구간 인덱스 계산
        const transitIdxs = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
        .map(x => x.idx);

        // ✅ 환승 도보시간(분) 계산 (없으면 0)
        let walkBufferMin = 0;
        if (transitIdxs.length >= 2) {
        walkBufferMin = await computeTransferBufferMin(subPaths, transitIdxs[0], transitIdxs[1]);
        console.log('🚶 transferBufferMin (2-leg):', walkBufferMin);
        }

        // ✅ 도보시간을 포함한 기준으로 1:1 매칭
        const allWaitPairs = getAllMinWaitPairs(
        dep1,
        dep2,
        result[0],
        result[1],
        walkBufferMin      // ⬅️ 새로 추가된 인자
        );

        // ✅ 이제는 최대 대기시간 초과만 필터링
        let pairsFiltered = allWaitPairs.filter(p => p.waitMinutes <= MAX_TRANSFER_WAIT_MIN);

        const useFromAsKey = dep1.length < dep2.length;
        const uniqueWaitPairs = getUniqueMinWaits(pairsFiltered, useFromAsKey);
        allTransfers = uniqueWaitPairs;

        return { transfers: allTransfers, dep2: dep2 || [], timetableCandidate };

    } else if (result.length === 3) {
        // 이하 3구간 로직은 그대로 유지


      // ✅ 3구간: 중간구간(두번째 구간)을 드라이버로 환승쌍 생성
      // 스케줄 4종 준비: (연산 예시) 1호선 도착@from, 3호선 출발@from, 3호선 도착@to, 2호선 출발@to
      // B) 만약 기존처럼 "출발표"만 리턴한다면(배열): 도착표는 sectionTime을 더해 구성한다.
      const depPrev_at_prevStation = await fetchDeparturesForSection(result[0].subPath, day); // 구간1 출발표
      const depMid_at_from         = await fetchDeparturesForSection(result[1].subPath, day); // 구간2 출발표(=from)
      const depNext_at_to          = await fetchDeparturesForSection(result[2].subPath, day); // 구간3 출발표(=to)
      dep2 = depNext_at_to; // 기존 호환: 두 번째 환승의 "다음 탑승"
        
        const ok0 = Array.isArray(depPrev_at_prevStation) && depPrev_at_prevStation.length > 0;
        const ok1 = Array.isArray(depMid_at_from) && depMid_at_from.length > 0;
        const ok2 = Array.isArray(depNext_at_to) && depNext_at_to.length > 0;
        const timetableCandidate = ok0 && ok1 && ok2;

      if (!Array.isArray(depPrev_at_prevStation) || !Array.isArray(depMid_at_from) || !Array.isArray(depNext_at_to)) {
        console.error('❌ schedule arrays missing or invalid');
        return { transfers: [], dep2: dep2 || [], timetableCandidate: false };
      }
      // 도착표 구성: arrPrev_at_from = depPrev + sectionTime(구간1)
      const sec1 = result[0]?.sectionTime || 0;
      const sec2 = result[1]?.sectionTime || 0;
      const sec3 = result[2]?.sectionTime || 0;
      const arrPrev_at_from = depPrev_at_prevStation.map(t => addMinutesToTime(t, sec1));

      // 중간구간 도착표는: arrMid_at_to = depMid@from + sec2 (단선/무정차 가정)
      const arrMid_at_to = depMid_at_from.map(t => addMinutesToTime(t, sec2));

      // 원본 subPaths에서 실제 대중교통 구간 인덱스 3개
      const transitIdxs = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
        .map(x => x.idx);
      const [idx0, idx1, idx2] = transitIdxs;

      // 환승 도보시간(버퍼)
      const walk1 = await computeTransferBufferMin(subPaths, idx0, idx1); // 1→2
      const walk2 = await computeTransferBufferMin(subPaths, idx1, idx2); // 2→3
      console.debug('🔎 transfer buffers', { walk1, walk2 });

      // 🔧 새 빌더로 두 환승쌍 생성(도보시간은 빌더에서 이미 반영하므로 이후 추가 차감 금지)
      const pairs1 = buildPairs_Prev_to_Mid_using_MidDep(arrPrev_at_from, depMid_at_from, walk1);
      const pairs2 = buildPairs_Mid_to_Next_using_MidArr(arrMid_at_to, depNext_at_to, walk2);

      const pairs1Capped = pairs1.filter(p => p.waitMinutes <= MAX_TRANSFER_WAIT_MIN);
      const pairs2Capped = pairs2.filter(p => p.waitMinutes <= MAX_TRANSFER_WAIT_MIN);

       // 🔧 필드 보정 (transformT / groupedTransfers와의 인터페이스 정합)
      // - pairs1: 첫 구간 real board/second alight 채우기
      const patched1 = pairs1Capped.map(p => ({
        ...p,
        // 첫 구간 실제 탑승 = 첫 구간 하차(firstAlightAt) - sec1
        firstBoardAt: subtractMinutesFromTime(p.firstAlightAt, sec1),
        // 두 번째 구간 하차 = 두 번째 구간 탑승(secondBoardAt) + sec2
        secondAlightAt: addMinutesToTime(p.secondBoardAt, sec2),
      }));

      // - pairs2: 이 군의 '탑승키'를 firstBoardAt으로도 노출(그대로 b),
      //           마지막 하차(secondAlightAt)를 sec3로 계산해서 transformT가 사용 가능하게
      const patched2 = pairs2Capped.map(p => ({
        ...p,
        firstBoardAt: subtractMinutesFromTime(p.from, sec2),  // ✅ (d: 3호선 출발@연산)           
        secondAlightAt: addMinutesToTime(p.secondBoardAt, sec3),
      }));

      // ✅ g1: a = 이전구간 도착시각 = firstAlightAt
      const unique1 = sortByKeyTime(
        dedupeByKeyMin(patched1, t => t.firstAlightAt),
        t => t.firstAlightAt
      );

      // ✅ g2: b = 다음구간 출발시각 = secondBoardAt
      const unique2 = sortByKeyTime(
        dedupeByKeyMin(patched2, t => t.secondBoardAt),
        t => t.secondBoardAt
      );


      // 환승 2번 → [첫 환승 배열, 두 번째 환승 배열]
      allTransfers = [unique1, unique2];
      return { transfers: allTransfers, dep2: dep2 || [], timetableCandidate };

    }

    // ✅ A-5) 함수 마지막 기본 반환에도 플래그 기본값 포함(공통 fallback)
    const fetchStatus = []; // 정보를 못 모았을 때의 디폴트
    const timetableCandidate =
    Array.isArray(allTransfers) &&
    (
        // 2구간(평면 배열) 케이스
        (!Array.isArray(allTransfers[0]) && allTransfers.length > 0)
        ||
        // 3구간([[], []]) 케이스: 어느 그룹이라도 비어있지 않으면 true
        (Array.isArray(allTransfers[0]) && ((allTransfers[0]?.length || 0) > 0 || (allTransfers[1]?.length || 0) > 0))
    );

    return {
    transfers: allTransfers,
    dep2: dep2 || [],
    fetchStatus,
    timetableCandidate
    };

  }

  // ===== [단일 구간 시간 계산 유틸] =====
  function computeSingleLegTimes(subPaths, transitIdx, depList) {
    const sectionTime = subPaths[transitIdx]?.sectionTime || 0;
    const totalBefore = getSectionTimesBefore(subPaths, transitIdx).reduce((a,b)=>a+b,0);
    const totalAfter  = getSectionTimesAfter(subPaths, transitIdx).reduce((a,b)=>a+b,0);

    return depList.map(dep => {
      const realFrom = subtractMinutesFromTime(dep, totalBefore);  // 여정 실제 출발
      const alightAt = addMinutesToTime(dep, sectionTime);         // 구간 하차(정류장/역)
      const realTo   = addMinutesToTime(alightAt, totalAfter);     // 여정 실제 도착

      return {
        boardAt: dep,        // 정류장/역 탑승시각
        alightAt,            // 정류장/역 하차시각
        waitMinutes: 0,      // 단일구간은 환승대기 없음
        realFrom,            // 여정 출발시각(집에서 나선 시간)
        realTo               // 여정 최종 도착시각
      };
    });
  }

  //환승블록변환 (realFrom/realTo 계산 포함)
  /**
     * 환승 정보 변환 및 출발/도착시간 계산
     *
     * @param {Array} transfers - getRootTransfers에서 얻은 환승 정보
     * @param {Array} sectionTimesBefore - from 기준으로 이전 구간들의 이동시간 배열 (단위: 분)
     * @param {Array} sectionTimesAfter - to 기준으로 이후 구간들의 이동시간 배열 (단위: 분)
     * @returns {Object}
     */
    function transformT(transfers, subPaths, transferIndex, dep2 = []) {
      // case 1: 두 구간 → transfers는 [{...}, {...}] (객체 배열)
      if (transfers.length > 0 && !Array.isArray(transfers[0])) {
        // ✅ 실제 대중교통(1|2) 구간 인덱스 2개를 구함
        const transitIdxs = (subPaths || [])
          .map((p, idx) => ({ p, idx }))
          .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
          .map(x => x.idx);
  
        const firstTransitIdx  = transitIdxs[0] ?? transferIndex;         // 첫 대중교통 구간
        const secondTransitIdx = transitIdxs[1] ?? (transferIndex + 1);    // 두 번째 대중교통 구간
  
        // 첫 구간 "이전" 합(도보 등)
        const totalBeforeNonTransit = subPaths
          .slice(0, firstTransitIdx)
          .reduce((sum, seg) => sum + (seg.sectionTime || 0), 0);
  
        // 첫 대중교통 구간 자체 시간
        const firstTransitDur = subPaths[firstTransitIdx]?.sectionTime || 0;
  
        // 두 번째 대중교통 구간 "탑승 이후" 남은 전체 시간(두 번째 구간 포함 + 이후 도보)
        const totalAfterFromSecond = subPaths
          .slice(secondTransitIdx) // ← 두 번째 대중교통부터 끝까지 (포함)
          .reduce((sum, seg) => sum + (seg.sectionTime || 0), 0);
  
        return [
          transfers.map(t => {
            // ✅ t.from = 첫 구간 "하차시각"이므로,
            //    출발시각 = t.from - (첫 구간 이전 전체 + 첫 대중교통 구간 시간)
            const realFrom = subtractMinutesFromTime(
              t.from,  // t.from = firstAlightAt
              totalBeforeNonTransit + firstTransitDur
            );
  
            // ✅ t.to = 두 번째 구간 "출발시각"이므로,
            //    도착시각 = t.to + (두 번째 대중교통 구간 시간 + 이후 전체)
            const realTo = addMinutesToTime(
              t.to, // t.to = secondBoardAt
              totalAfterFromSecond
            );
  
            return {
              waitMinutes: t.waitMinutes, // (이미 getRootTransfers에서 도보시간 차감 완료)
              realFrom, //출발시간
              realTo, //도착시간
              firstBoardAt: t.firstBoardAt, 
              firstAlightAt: t.firstAlightAt,
              secondBoardAt: t.secondBoardAt,
              secondAlightAt: t.secondAlightAt
            };
          })
        ];
      }
      // case 2: 세 구간 → transfers는 [ [...], [...] ]
      else {
          let transformed = [];
  
          // ⬇️ 추가: 세 구간의 대중교통 인덱스와 환승 사이 도보 버퍼 계산
          const transitIdxs = (subPaths || [])
            .map((p, idx) => ({ p, idx }))
            .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
            .map(x => x.idx);
  
          const [idx0, idx1, idx2] = [transitIdxs[0], transitIdxs[1], transitIdxs[2]];
          const walkBuffer1 = getWalkMinutesBetween(subPaths, idx0, idx1) || 0; // (참고) 1→2
          const walkBuffer2 = getWalkMinutesBetween(subPaths, idx1, idx2) || 0; // 2→3


          // 첫 대중교통 이전(도보 등) 전체 시간 합 → 진짜 “여정 출발” 계산용
          const totalBeforeNonTransit = (idx0 != null)
            ? subPaths.slice(0, idx0).reduce((s, seg) => s + (seg.sectionTime || 0), 0)
            : 0;

          let prevToArr = []; // 첫 번째 환승 그룹의 to 값들을 저장
  
          for (let groupIdx = 0; groupIdx < transfers.length; groupIdx++) {
            const group = transfers[groupIdx];
            // 두 번째 환승 이후 구간부터 끝까지만 계산
            const sectionTimesAfter = getSectionTimesAfter(
                subPaths,
                transferIndex + groupIdx
            );
            const totalAfter = sectionTimesAfter.reduce((a, b) => a + b, 0);
  
            let transformedGroup = [];
  
            for (let tIdx = 0; tIdx < group.length; tIdx++) {
              const t = group[tIdx];
  
              let newFrom;
              let newTo;
              let waitMinutes = null;
  
              if (groupIdx === 0) {
                // 첫 번째 환승
                newFrom = t.from;
                newTo = t.to;
                prevToArr[tIdx] = t.to; // 그대로 유지
                waitMinutes = t.waitMinutes;  
  
              } else {
                // 두 번째 환승 (상위 getRootTransfers에서 walk2 필터/차감 완료된 값을 그대로 사용)
  
                const prevTo = prevToArr[tIdx];
                if (!prevTo) {
                  console.error("🚨 이전 환승 realTo 값이 없습니다. 건너뜁니다.");
                  continue;
                }
  
                // 현재(두 번째) 구간 소요시간
                const currentSection = subPaths[transferIndex + groupIdx];
                const currentSectionTime = currentSection?.sectionTime || 0;
  
                // ✅ getRootTransfers에서 이미 walk2 반영된 pair(t)를 그대로 사용
                newFrom = t.from;           // 두 번째 구간 하차시각(=세 번째 탑승 직전 시각)
                newTo   = t.to;             // 세 번째 구간 탑승시각
                waitMinutes = t.waitMinutes; // 이미 walk2 차감된 값 (이중 차감 금지)
                
                // 🔧 transfer2(두 번째 환승): 마지막 하차 + '하차 이후' 도보만
                // ✅ 마지막(3번째) 대중교통 구간 인덱스는 idx2. 그 '이후'만 합산 = 하차 이후 도보만
                const afterWalkOnly = getSectionTimesAfter(subPaths, idx2)
                  .reduce((a, b) => a + b, 0);
                const finalArrival = addMinutesToTime(t.secondAlightAt, afterWalkOnly);

                transformedGroup.push({
                  transferNo: groupIdx + 1,
                  waitMinutes,
                  realTo: finalArrival, // 최종 도착 = secondAlightAt + (하차 이후 도보만)
                  firstBoardAt: t.firstBoardAt,
                  firstAlightAt: t.firstAlightAt,
                  secondBoardAt: t.secondBoardAt,
                  secondAlightAt: t.secondAlightAt
                });
  
                continue; // 분기 명확화 (다음 tIdx로)
              }
  
               // 🔧 transfer1(첫 번째 환승): '여정 출발(realFrom)'만 넣기
                transformedGroup.push({
                  transferNo: groupIdx + 1,
                  waitMinutes,
                  // 여정 출발 = 첫 대중교통 탑승시각 - (첫 대중교통 이전 전체 구간 합)
                  realFrom: subtractMinutesFromTime(t.firstBoardAt, totalBeforeNonTransit),
                  firstBoardAt: t.firstBoardAt,
                  firstAlightAt: t.firstAlightAt,
                  secondBoardAt: t.secondBoardAt,
                  secondAlightAt: t.secondAlightAt
                });
              } // ← 여기서 tIdx 루프를 닫는다

              transformed.push(transformedGroup); // ← tIdx 루프 바깥에서 그룹을 한 번만 푸시
            } // ← groupIdx 루프 닫기

            return transformed; // ← case 2 반환      
        }
    }

    /* ===================== public service ===================== */
// [수정됨] computeTransferWaitTimes 함수 전체를 아래 코드로 교체하세요.

    /* ===================== public service ===================== */
    async function computeTransferWaitTimes({ sx, sy, ex, ey, day, pathIndex }) {
    // 1) ODsay 경로 조회
    const { subPaths, totalPayment, totalTime } =
        await searchPath({ sx, sy, ex, ey, pathIndex });

    // 2) 대중교통(1|2)만 추려 result 만들기
    const result = (subPaths || [])
        .filter(item => item.trafficType === 1 || item.trafficType === 2)
        .map(item => ({
        startName: item.startName,
        startID: item.startID,
        endName: item.endName,
        endID: item.endID,
        wayCode: item.wayCode,
        subwayCode: item.lane?.[0]?.subwayCode || null,
        busNo: normalizeBusRouteId(item.lane?.[0]?.busNo || item.lane?.[0]?.busID || ''),
        busID: item.lane?.[0]?.busID || null,
        sectionTime: item.sectionTime || 0,
        subPath: item
        }));

    // 모든 대중교통 구간의 인덱스를 찾음
    const transitIdxs = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
        .map(x => x.idx);
    const transferIndex = transitIdxs[0] ?? 0;

    // [추가됨] 모든 환승 도보 구간의 실제 시간을 미리 계산하여 Map에 저장
    const transferWalkTimes = new Map();
    if (transitIdxs.length > 1) {
        for (let i = 0; i < transitIdxs.length - 1; i++) {
            const fromIdx = transitIdxs[i];
            const toIdx = transitIdxs[i+1];
            
            // 실제 도보 시간을 계산합니다 (초 단위)
            const walkSeconds = await getWalkMinutesBetween(subPaths, fromIdx, toIdx);
            const walkMinutes = Math.ceil(walkSeconds / 60); // 초를 분으로 변환하고 올림

            // 두 대중교통 구간 '사이'에 있는 도보(trafficType: 3) 구간을 찾습니다.
            for (let j = fromIdx + 1; j < toIdx; j++) {
                if (subPaths[j].trafficType === 3) {
                    // 해당 도보 구간의 인덱스를 key로, 계산된 도보 시간(분)을 value로 저장
                    transferWalkTimes.set(j, walkMinutes);
                    console.log(`[사전 계산] subPaths[${j}] 도보 구간 시간: ${walkMinutes}분`);
                }
            }
        }
    }


    // 3) 환승쌍 계산 & 변환
    const { transfers, dep2, timetableCandidate = true } = await getRootTransfers(result, day, subPaths);
    const transformed = transformT(transfers || [], subPaths || [], transferIndex, dep2 || []);

    // 4) 단일 구간(대중교통이 1개뿐)인 경우 처리
    const transitIndices = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p.trafficType === 1 || x.p.trafficType === 2);

    let singleLegTimes = null;
    if (transitIndices.length === 1) {
        const { p: onlyTransit, idx: transitIdx } = transitIndices[0];
        const depList = await fetchDeparturesForSection(onlyTransit, day);
        singleLegTimes = computeSingleLegTimes(subPaths, transitIdx, depList);
    }

    // 5) 세부 경로/요약 만들기
    const flatTransfers = Array.isArray(transfers?.[0]) ? transfers.flat() : (transfers || []);
    const routeDetails = (subPaths || []).map((p, i) => {
        let name = '';
        let time = p.sectionTime; // 기본값은 원본 데이터의 sectionTime
        let distance = p.distance || null;
        let detail = {};

        const prev = subPaths[i - 1];
        const next = subPaths[i + 1];
        const isTransit = (t) => t && (t.trafficType === 1 || t.trafficType === 2);
        const isBetweenTransit = isTransit(prev) && isTransit(next);
        const isTransferPath = (p.trafficType === 3) && isBetweenTransit;

        if (isTransferPath) {
          name = '도보';
          // [수정됨] 미리 계산해둔 transferWalkTimes Map에서 실제 도보 시간을 가져옴
          if (transferWalkTimes.has(i)) {
              time = transferWalkTimes.get(i); // time 변수의 값을 새로 계산된 값으로 덮어씀
          }
          detail = { 설명: '대중교통 사이 도보 이동(실도보 적용)' };
        } else if (p.trafficType === 1) {
        name = '지하철';
        const detailPath = (p.passStopList?.stations || []).map(station => ({
            역이름: station.stationName || null,
            역ID: station.stationID || null,
            지역ID: station.stationCityCode || null,
            역좌표: { x: station.x || null, y: station.y || null }
        }));
        detail = {
            노선이름: p.lane?.[0]?.name || null,
            노선ID: p.lane?.[0]?.subwayCode || null,
            역개수: p.stationCount || null,
            탑승역: { 이름: p.startName || null, 위도: p.startY || null, 경도: p.startX || null },
            하차역: { 이름: p.endName || null,   위도: p.endY || null, 경도: p.endX || null },
            세부경로: detailPath
        };
        const match = flatTransfers.find(t =>
            t.toStation &&
            normalizeStopName(t.toStation) === normalizeStopName(p.startName) &&
            String(t.toLine ?? '') === String(p.lane?.[0]?.subwayCode ?? '')
        );
        if (match && match.waitMinutes != null) {
            detail.환승대기시간 = `${match.waitMinutes}분`;
        }
        return {
            이동수단: name,
            이동시간: typeof time === 'number' ? `${time}` : time,
            이동거리: distance !== null ? `${distance}` : null,
            노선: detail
        };
        } else if (p.trafficType === 2) {
        name = '버스';
        const detailPath = (p.passStopList?.stations || []).map(station => ({
            정류장_이름: station.stationName || null,
            정류장_ID: station.stationID || null,
            지역_ID: station.stationCityCode || null,
            정류장_좌표: { x: station.x || null, y: station.y || null }
        }));
        const lineInfo = {
            버스번호: p.lane?.[0]?.busNo || null,
            버스ID: p.lane?.[0]?.busID || null,
            버스노선ID: p.lane?.[0]?.busCityCode || null
        };
        const busMatch = flatTransfers.find(t =>
            t.toStation && normalizeStopName(t.toStation) === normalizeStopName(p.startName) &&
            (t.toBusNo == null ||
            normalizeBusRouteId(t.toBusNo) === normalizeBusRouteId(p.lane?.[0]?.busNo))
        );
        if (busMatch && Number.isFinite(busMatch.waitMinutes)) {
            lineInfo.환승대기시간 = `${busMatch.waitMinutes}분`;
        }
        return {
            이동수단: name,
            이동시간: typeof time === 'number' ? `${time}` : time,
            이동거리: distance !== null ? `${distance}` : null,
            노선: lineInfo,
            정류장_개수: p.stationCount || 0,
            탑승_정류장: { 이름: p.startName || null, 위도: p.startY || null, 경도: p.startX || null },
            하차_정류장: { 이름: p.endName || null,   위도: p.endY || null, 경도: p.endX || null },
            세부_경로: detailPath
        };
        } else {
        name = '도보';
        }

        const base = {
        이동수단: name,
        이동시간: typeof time === 'number' ? `${time}` : time,
        이동거리: distance !== null ? `${distance}` : null
        };
        if (name !== '도보' && name !== '환승 통로') base['노선'] = detail;
        if (name === '환승 통로') base['설명'] = '역 간 환승 통로 이동';
        return base;
    });

    const summary = routeDetails
        .map(r => `${r.이동수단} ${typeof r.이동시간 === 'string' ? r.이동시간 : `${r.이동시간}`}`)
        .join(' → ');
    const summaryWithFare = totalPayment ? `${summary} (총 요금 ${totalPayment}원)` : summary;

    // 시간표가 비었으면: summary는 유지, result는 빈 배열 + 안내 메시지
    if (!timetableCandidate) {
        const hasSingle = Array.isArray(singleLegTimes) && singleLegTimes.length > 0;
        if (!timetableCandidate && !hasSingle) {
            return {
                
                summary: summaryWithFare,
                result: {
                경로: {
                    '이동수단': [],
                    '출발 시간': [],
                    '도착 시간': [],
                    '환승 대기 시간': [],
                    '총 소요 시간': totalTime || null,
                    '요금': totalPayment || null,
                    '세부 경로': routeDetails,
                    '메시지': '현재 시간표 데이터가 없어 상세 시간은 잠시 후 다시 시도해주세요.'
                }
                },
                groupedTransfers: [],
                singleLegTimes: null,
                meta: { timetableReady: false }
            };
        }    
    }

    const vehicleArray = routeDetails.map(r => r.이동수단);

    // 6) 출발/도착/대기 배열 (이하 변경 없음)
    let realFromArray = [];
    let realToArray = [];
    let waitMinutesArray = [];

    if (singleLegTimes && singleLegTimes.length > 0) {
        realFromArray    = singleLegTimes.map(x => x.realFrom);
        realToArray      = singleLegTimes.map(x => x.realTo);
        waitMinutesArray = singleLegTimes.map(() => [0]);
    } else if (Array.isArray(transformed?.[0])) {
        const firstGroup = transformed[0] || [];
        const lastGroup  = transformed[transformed.length - 1] || [];
        realFromArray = firstGroup.map(t => t.realFrom);
        realToArray   = lastGroup.map(t => t.realTo);
        const groupsWait = transformed.map(group => group.map(t => t.waitMinutes));
        waitMinutesArray = transpose(groupsWait);
    } else if (Array.isArray(transformed)) {
        realFromArray    = transformed.map(t => t.realFrom);
        realToArray      = transformed.map(t => t.realTo);
        waitMinutesArray = transformed.map(t => [t.waitMinutes]);
    }


    // 7) groupedTransfers (UI용)
    let groupedTransfers = [];

    if (Array.isArray(transformed?.[0])) {
      const groupCount = transformed.length;

      if (groupCount >= 2) {
        const g1 = transformed[0] || [];
        const g2 = transformed[1] || [];

        const mapByFirstBoard = new Map(g2.map(x => [x.firstBoardAt, x]));
        const groupedTransfersRaw = g1.map(x => ({
          transfer1: x,
          transfer2: mapByFirstBoard.get(x.secondBoardAt) || null,
        }));

        groupedTransfers = groupedTransfersRaw.filter(g => g.transfer1 && g.transfer2);

      } else {
        const g = transformed[0] || [];
        groupedTransfers = g.map(t => ({ transfer1: t, transfer2: null }));
      }

    } else if (Array.isArray(transformed)) {
      groupedTransfers = transformed.map(t => ({ transfer1: t, transfer2: null }));
    }

    if (!singleLegTimes || singleLegTimes.length === 0) {
      waitMinutesArray = groupedTransfers.map(({ transfer1, transfer2 }) => {
        const arr = [];
        if (transfer1 && Number.isFinite(transfer1.waitMinutes)) arr.push(transfer1.waitMinutes);
        if (transfer2 && Number.isFinite(transfer2.waitMinutes)) arr.push(transfer2.waitMinutes);
        return arr;
      });
    }



    // 8) 최종 payload
    return {
        summary: summaryWithFare,
        result: {
        경로: {
            '이동수단': vehicleArray,
            '출발 시간': realFromArray,
            '도착 시간': realToArray,
            '환승 대기 시간': waitMinutesArray,
            '총 소요 시간': totalTime || null,
            '요금': totalPayment || null,
            '세부 경로': routeDetails
        }
        },
        groupedTransfers,
        singleLegTimes: singleLegTimes || null
    };
    }

   module.exports = { computeTransferWaitTimes };