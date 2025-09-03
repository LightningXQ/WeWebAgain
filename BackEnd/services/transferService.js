const { searchPath } = require('./pathService');            // ODsay 경로검색 래퍼(필요시)
const { fetchDeparturesForSection } = require('./scheduleService');
const { getSectionTimesBefore, getSectionTimesAfter, getWalkMinutesBetween, transpose } = require('../utils/pathHelpers');
const { minutesToTime, timeToMinutes, isWithinServiceMin, addMinutesToTime, subtractMinutesFromTime } = require('../utils/time');
const { normalizeBusRouteId, normalizeStopName } = require('../utils/normalize');

//대기쌍 계산
// A 열차 도착 직후 B 열차가 언제 있는지 찾아서 두 열차 간 대기시간 구함
  function getAllMinWaitPairs(scheduleA, scheduleB, fromSection, toSection) {
    const aMinutes = scheduleA.map(timeToMinutes);
    const bMinutes = scheduleB.map(timeToMinutes);

    const results = [];
    for (let i = 0; i < aMinutes.length; i++) {
      const aTime = aMinutes[i];

      const sectionTime = fromSection?.sectionTime || 0;
      const arrivalTime = aTime + sectionTime; // 출발 + 소요시간 → 도착 시각

      // ✅ A 도착시각 서비스 윈도우 체크 (05:00~24:00)
      if (!isWithinServiceMin(arrivalTime)) continue;

      const bMatch =  bMinutes.find(bTime => bTime >= arrivalTime); // ✅ 도착 이후
      if (bMatch !== undefined) {
        const waitMinutes = bMatch - arrivalTime;
        // ✅ B 출발도 서비스 윈도우 안인지 확인 + 환승 최소 3분
        if (waitMinutes >= 3 && isWithinServiceMin(bMatch)) {
          results.push({
            from: minutesToTime(arrivalTime), // 도착시각으로
            to: minutesToTime(bMatch),
            waitMinutes,
            fromLine: fromSection?.subwayCode || null,
            fromStation: fromSection.endName,
            toLine: toSection?.subwayCode || null,
            toStation: toSection.startName,
            fromBusNo: normalizeBusRouteId(fromSection?.busNo || fromSection?.subPath?.lane?.[0]?.busNo || ''),
            toBusNo: normalizeBusRouteId(toSection?.busNo || toSection?.subPath?.lane?.[0]?.busNo || ''),
          });
        }
      }
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
        dep2 = await fetchDeparturesForSection(result[1].subPath, day);

        console.log("🔁 dep1 count:", dep1.length);
        console.log("🔁 dep2 count:", dep2.length);

        const allWaitPairs = getAllMinWaitPairs(dep1, dep2, result[0], result[1]);

        // 원본 subPaths를 이용해 진짜 대중교통 구간 인덱스 계산
        const transitIdxs = (subPaths || [])
          .map((p, idx) => ({ p, idx }))
          .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
          .map(x => x.idx);

        // 도보시간 반영: 짧은 환승 제거 + waitMinutes 차감
        let pairsFiltered = allWaitPairs;
        if (transitIdxs.length >= 2) {
          const walkBufferMin = getWalkMinutesBetween(subPaths, transitIdxs[0], transitIdxs[1]);
          console.log('🚶 walkBufferMin:', walkBufferMin);

          // 1) 도보시간보다 짧으면 제거
          pairsFiltered = allWaitPairs.filter(p => p.waitMinutes >= walkBufferMin);

          // 2) 도보시간을 빼고, 음수는 0으로 보정
          pairsFiltered = pairsFiltered.map(p => ({
            ...p,
            waitMinutes: Math.max(0, p.waitMinutes - walkBufferMin)
          }));
        }

        const useFromAsKey = dep1.length < dep2.length;
        const uniqueWaitPairs = getUniqueMinWaits(pairsFiltered, useFromAsKey);
        allTransfers = uniqueWaitPairs;

    } else if (result.length === 3) {

      // ✅ 지하철/버스를 자동 구분해서 출발시각 배열을 가져옵니다.
      //    (fetchDeparturesForSection 내부에서 trafficType에 따라
      //     ODCloud(지하철) 또는 CSV(버스)에서 가져오도록 구현되어 있어야 합니다.)
      const dep1 = await fetchDeparturesForSection(result[0].subPath, day);
      const depMid = await fetchDeparturesForSection(result[1].subPath, day);
      const dep3 = await fetchDeparturesForSection(result[2].subPath, day);
      dep2 = dep3;   // ✅ 두 번째 환승의 "다음 탑승"은 3번째 구간 출발표를 봐야 함

      // ✅ 방어: 하나라도 비어있으면 계산 불가
      if (dep1.length === 0 || depMid.length === 0 || dep3.length === 0) {
        console.error('❌ Some schedules missing (3-section).', {
          dep1: dep1.length, depMid: depMid.length, dep3: dep3.length
        });
        return { transfers: [], dep2: dep2 || [] };
      }

      // ✅ 첫 번째 환승(구간1 → 구간2), 두 번째 환승(구간2 → 구간3)
      const pairs1 = getAllMinWaitPairs(dep1, depMid, result[0], result[1]);
      const pairs2 = getAllMinWaitPairs(depMid, dep3, result[1], result[2]);

      // 🔎 원본 subPaths에서 실제 대중교통 구간 인덱스 3개를 구함
      const transitIdxs = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
        .map(x => x.idx);

      const [idx0, idx1, idx2] = transitIdxs;
      const walk1 = getWalkMinutesBetween(subPaths, idx0, idx1); // 1→2 사이 도보합
      const walk2 = getWalkMinutesBetween(subPaths, idx1, idx2); // 2→3 사이 도보합
      console.log('🚶 walk1(1→2):', walk1, '🚶 walk2(2→3):', walk2);

      // 1) 도보시간보다 짧은 환승 쌍 제거 + 2) 도보시간 차감
      let filtered1 = pairs1
        .filter(p => p.waitMinutes >= walk1)
        .map(p => ({ ...p, waitMinutes: Math.max(0, p.waitMinutes - walk1) }));

      let filtered2 = pairs2
        .filter(p => p.waitMinutes >= walk2)
        .map(p => ({ ...p, waitMinutes: Math.max(0, p.waitMinutes - walk2) }));

      // 키 기준 중복 제거(더 짧은 대기만 남김)
      // 첫 환승은 dep1 vs depMid, 두 번째 환승은 depMid vs dep3
      const useFromAsKey1 = dep1.length < depMid.length;
      const useFromAsKey2 = depMid.length < dep3.length;

      const unique1 = getUniqueMinWaits(filtered1, useFromAsKey1);
      const unique2 = getUniqueMinWaits(filtered2, !useFromAsKey2);

      // 환승 2번 → [첫 환승 배열, 두 번째 환승 배열]
      allTransfers = [unique1, unique2];
    }

    return {
      transfers: allTransfers,
      dep2: dep2 || []
    };
  }

  // ===== [단일 구간 시간 계산 유틸] =====
  function computeSingleLegTimes(subPaths, transitIdx, depList) {
    const sectionTime = subPaths[transitIdx]?.sectionTime || 0;
    const totalBefore = getSectionTimesBefore(subPaths, transitIdx).reduce((a,b)=>a+b,0);
    const totalAfter  = getSectionTimesAfter(subPaths, transitIdx).reduce((a,b)=>a+b,0);

    return depList.map(dep => {
      const realFrom = subtractMinutesFromTime(dep, totalBefore);  // 여정 실제 출발
      const alightAt = addMinutesToTime(dep, sectionTime);         // 구간 하차(정류장/역)
      const realTo   = addMinutesToTime(alightAt, totalAfter);     // 여정 실제 도착

      return {
        boardAt: dep,        // 정류장/역 탑승시각
        alightAt,            // 정류장/역 하차시각
        waitMinutes: 0,      // 단일구간은 환승대기 없음
        realFrom,            // 여정 출발시각(집에서 나선 시간)
        realTo               // 여정 최종 도착시각
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
  
        const firstTransitIdx  = transitIdxs[0] ?? transferIndex;         // 첫 대중교통 구간
        const secondTransitIdx = transitIdxs[1] ?? (transferIndex + 1);    // 두 번째 대중교통 구간
  
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
            //    출발시각 = t.from - (첫 구간 이전 전체 + 첫 대중교통 구간 시간)
            const realFrom = subtractMinutesFromTime(
              t.from,
              totalBeforeNonTransit + firstTransitDur
            );
  
            // ✅ t.to = 두 번째 구간 "출발시각"이므로,
            //    도착시각 = t.to + (두 번째 대중교통 구간 시간 + 이후 전체)
            const realTo = addMinutesToTime(
              t.to,
              totalAfterFromSecond
            );
  
            return {
              from: t.from,
              to: t.to,
              waitMinutes: t.waitMinutes, // (이미 getRootTransfers에서 도보시간 차감 완료)
              realFrom,
              realTo
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
              let realFrom;
              let realTo;
  
              if (groupIdx === 0) {
                // 첫 번째 환승
                const sectionTimesBefore = getSectionTimesBefore(subPaths, transferIndex);
                const totalBefore = sectionTimesBefore.reduce((a, b) => a + b, 0);
  
                newFrom = t.from;
                realFrom = subtractMinutesFromTime(newFrom, totalBefore);
  
                newTo = t.to;
                realTo = t.to;
  
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
  
                // (선택) 일관성 체크: prevTo + currentSectionTime 이 t.from 과 일치하는지 확인
                const expectedFrom = addMinutesToTime(prevTo, currentSectionTime);
                if (expectedFrom !== t.from) {
                  console.warn(`⚠️ pair 불일치: expectedFrom=${expectedFrom}, pair.from=${t.from}`);
                }
  
                // ✅ getRootTransfers에서 이미 walk2 반영된 pair(t)를 그대로 사용
                newFrom = t.from;           // 두 번째 구간 하차시각(=세 번째 탑승 직전 시각)
                newTo   = t.to;             // 세 번째 구간 탑승시각
                waitMinutes = t.waitMinutes; // 이미 walk2 차감된 값 (이중 차감 금지)
  
                realFrom = newFrom;                     // 여정 상 환승 시작 시각
                realTo   = addMinutesToTime(newTo, totalAfter); // 여정 최종 도착
  
                transformedGroup.push({
                  transferNo: groupIdx + 1,
                  from: newFrom,
                  to: newTo,
                  waitMinutes,
                  fromLine: t.fromLine,
                  fromStation: t.fromStation,
                  toLine: t.toLine,
                  toStation: t.toStation,
                  realFrom,
                  realTo            
                });
  
                continue; // 분기 명확화 (다음 tIdx로)
              }
  
              transformedGroup.push({
                transferNo: groupIdx + 1,
                from: newFrom,
                to: newTo,
                waitMinutes,
                fromLine: t.fromLine,
                fromStation: t.fromStation,
                toLine: t.toLine,
                toStation: t.toStation,
                realFrom,
                realTo
              });
            }
  
            transformed.push(transformedGroup);
          }
  
          return transformed;
            
        }
    }

    /* ===================== public service ===================== */
    async function computeTransferWaitTimes({ sx, sy, ex, ey, day, pathIndex }) {
    // 1) ODsay 경로 조회
    const { path, subPaths, totalPayment, totalTime } =
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

    // 환승 인덱스(첫 대중교통 구간 index)
    const transitIdxs = (subPaths || [])
        .map((p, idx) => ({ p, idx }))
        .filter(x => x.p && (x.p.trafficType === 1 || x.p.trafficType === 2))
        .map(x => x.idx);
    const transferIndex = transitIdxs[0] ?? 0;

    // 3) 환승쌍 계산 & 변환
    const { transfers, dep2 } = await getRootTransfers(result, day, subPaths);
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
        let time = p.sectionTime;
        let distance = p.distance || null;
        let detail = {};

        const prev = subPaths[i - 1];
        const next = subPaths[i + 1];
        const isTransferPath = (
        p.trafficType === 3 &&
        time === 0 &&
        (prev && (prev.trafficType === 1 || prev.trafficType === 2)) &&
        (next && (next.trafficType === 1 || next.trafficType === 2))
        );

        if (isTransferPath) {
        name = '환승 통로';
        time = '3분';
        distance = null;
        detail = { 설명: '역 간 환승 통로 이동' };
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
            하차역: { 이름: p.endName || null,   위도: p.endY || null, 경도: p.endX || null },
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
            하차_정류장: { 이름: p.endName || null,   위도: p.endY || null, 경도: p.endX || null },
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
        .map(r => `${r.이동수단} ${typeof r.이동시간 === 'string' ? r.이동시간 : `${r.이동시간}분`}`)
        .join(' → ');
    const summaryWithFare = totalPayment ? `${summary} (총 요금 ${totalPayment}원)` : summary;

    const vehicleArray = routeDetails.map(r => r.이동수단);

    // 6) 출발/도착/대기 배열
    let realFromArray = [];
    let realToArray = [];
    let waitMinutesArray = [];

    if (singleLegTimes && singleLegTimes.length > 0) {
        realFromArray    = singleLegTimes.map(x => x.realFrom);
        realToArray      = singleLegTimes.map(x => x.realTo);
        waitMinutesArray = singleLegTimes.map(() => [0]);
    } else if (Array.isArray(transformed?.[0])) {
        const firstGroup = transformed[0] || [];
        const lastGroup  = transformed[transformed.length - 1] || [];
        realFromArray = firstGroup.map(t => t.realFrom);
        realToArray   = lastGroup.map(t => t.realTo);
        const groupsWait = transformed.map(group => group.map(t => t.waitMinutes));
        waitMinutesArray = transpose(groupsWait);
    } else if (Array.isArray(transformed)) {
        realFromArray    = transformed.map(t => t.realFrom);
        realToArray      = transformed.map(t => t.realTo);
        waitMinutesArray = transformed.map(t => [t.waitMinutes]);
    }

    // 7) groupedTransfers (UI용)
    let groupedTransfers = [];
    if (Array.isArray(transformed?.[0])) {
        for (let i = 0; i < (transformed[0]?.length || 0); i++) {
        groupedTransfers.push({
            transfer1: transformed[0][i],
            transfer2: transformed[1]?.[i] || null
        });
        }
    } else if (Array.isArray(transformed)) {
        for (let i = 0; i < transformed.length; i++) {
        groupedTransfers.push({ transfer1: transformed[i], transfer2: null });
        }
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

