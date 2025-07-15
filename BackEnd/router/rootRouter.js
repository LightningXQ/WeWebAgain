  const express = require('express');
  const axios = require('axios');
  const router = express.Router();
  const API_KEY = 'IYCEsHB+QAVMoiYiqW6CVU3DdBoV1YAG3IQmmpYIZE8';

  router.use(express.json());

  router.post('/transfer-wait-times', async (req, res) => {
    const { sx, sy, ex, ey } = req.body;

    if (!sx || !sy || !ex || !ey) {
      return res.status(400).json({ error: 'sx, sy, ex, ey는 필수입니다.' });
    }

    try {
      // 1. 경로 검색
      const pathRes = await axios.get('https://api.odsay.com/v1/api/searchPubTransPath', {
        params: {
          apiKey: API_KEY,
          SX: sx,
          SY: sy,
          EX: ex,
          EY: ey,
          output: 'json'
        }
    });

    const pathList = pathRes.data.result.path;
    console.log("🔎 전체 경로 수:", pathList.length);

      const path = pathRes.data.result.path[4];
      const subPaths = path.subPath;
      const totalPayment = path.info?.payment;
      const totalTime = path.info?.totalTime;

      // ✅ get-root 로직 재사용
      const result = subPaths
        .filter(item => item.trafficType === 1)
        .map(item => ({
          startName: item.startName,
          startID: item.startID,
          endName: item.endName,
          endID: item.endID,
          wayCode : item.wayCode,
          subwayCode: item.lane?.[0]?.subwayCode || null
        }));

      // 예) 환승 인덱스
      const transferIndex = 2;

      const {transfers, dep2 } = await getRootTransfers(result);
      console.log("✅ dep2 (수영역 출발 시간표):", dep2);
      
      const t = transfers.find(x => x.waitMinutes >= 5); //혹시 모를 대비로 5분 이상
      const transformed = transformT(transfers, subPaths, transferIndex, dep2);

      // ✅ 여기서 groupedTransfers 만들어줌
      let groupedTransfers = [];

      if (transformed.length >= 2) {
        for (let i = 0; i < transformed[0].length; i++) {
          groupedTransfers.push({
            transfer1: transformed[0][i],
            transfer2: transformed[1]?.[i] || null
          });
        }
      }

      // subPaths 로부터 이동시간 배열 추출
      const sectionTimesBefore = getSectionTimesBefore(subPaths, transferIndex);
      const sectionTimesAfter = getSectionTimesAfter(subPaths, transferIndex);

      const totalBefore = sectionTimesBefore.reduce((a, b) => a + b, 0);
      const totalAfter = sectionTimesAfter.reduce((a, b) => a + b, 0);

      const from = t?.from || "05:30";
      const to = t?.to || "05:35";

      const realFromTime = minutesToTime(
        timeToMinutes(from) - totalBefore
      );
      const realToTime = minutesToTime(
        timeToMinutes(to) + totalAfter
      );


      // ✅ 네가 만든 routeDetails 코드 여기 붙이기
      const routeDetails = subPaths.map((p, i) => {
        let name = '';
        let time = p.sectionTime;
        let distance = p.distance || null;
        let detail = {};

        const prev = subPaths[i - 1];
        const next = subPaths[i + 1];
        const isTransferPath = (
          p.trafficType === 3 &&
          time === 0 &&
          prev?.trafficType === 1 &&
          next?.trafficType === 1
        );

        if (isTransferPath) {
          name = '환승 통로';
          time = "3분";
          distance = null;
          detail = {
            설명: '역 간 환승 통로 이동'
          };
        } else if (p.trafficType === 1) {
          // 지하철
          name = '지하철';

          // 세부경로 추가
          const detailPath = (p.passStopList?.stations || []).map(station => ({
            역이름: station.stationName || null,
            역ID: station.stationID || null,
            지역ID: station.stationCityCode || null,
            역좌표: {
              x: station.x || null,
              y: station.y || null
            }
          }));

          detail = {
            노선이름: p.lane?.[0]?.name || null,
            노선ID: p.lane?.[0]?.subwayCode || null,
            역개수: p.stationCount || null,
            탑승역: {
              이름: p.startName || null,
              위도: p.startY || null,
              경도: p.startX || null
            },
            하차역: {
              이름: p.endName || null,
              위도: p.endY || null,
              경도: p.endX || null
            },
            세부경로: detailPath
          };

          // ✅ 여기서 transfers 배열에서 매칭
          const transferMatch = transfers.find(t => 
            t.to === p.startName &&
            t.toLine === p.lane?.[0]?.subwayCode
          );
          if (transferMatch && transferMatch.waitMinutes != null) {
            detail.환승대기시간 = `${transferMatch.waitMinutes}분`;
          }

          const result = {
            이동수단: name,
            이동시간: typeof time === 'number' ? `${time}분` : time,
            이동거리: distance !== null ? `${distance}m` : null,
            노선: detail
          };

          return result;


        } else if (p.trafficType === 2) {
          // 버스
          name = '버스';

          const detailPath = (p.passStopList?.stations || []).map(station => ({
            정류장_이름: station.stationName || null,
            정류장_ID: station.stationID || null,
            지역_ID: station.stationCityCode || null,
            정류장_좌표: {
              x: station.x || null,
              y: station.y || null
            }
          }));

          // 노선에 딱 3개만
          const lineInfo = {
            버스번호: p.lane?.[0]?.busNo || null,
            버스ID: p.lane?.[0]?.busID || null,
            버스노선ID: p.lane?.[0]?.busCityCode || null
          };

            // result 객체
            const result = {
              이동수단: name,
              이동시간: typeof time === 'number' ? `${time}분` : time,
              이동거리: distance !== null ? `${distance}m` : null,
              노선: lineInfo,
              정류장_개수: p.stationCount || 0,
              탑승_정류장: {
                이름: p.startName || null,
                위도: p.startY || null,
                경도: p.startX || null
              },
              하차_정류장: {
                이름: p.endName || null,
                위도: p.endY || null,
                경도: p.endX || null
              },
              세부_경로: detailPath
            };

            return result;
            
        } else {
          // 도보
          name = '도보';
          detail = {};
        }

        const result = {
          이동수단: name,
          이동시간: typeof time === 'number' ? `${time}분` : time,
          이동거리: distance !== null ? `${distance}m` : null
        };


        if (name !== '도보' && name !== '환승 통로') {
          result["노선"] = detail;
        }

        if (name === '환승 통로') {
          result["설명"] = detail.설명;
        }

        return result;
      });

      // summary 생성
      const summary = routeDetails
        .map(r => {
          const timeStr = typeof r.이동시간 === 'string' ? r.이동시간 : `${r.이동시간}분`;
          return `${r.이동수단} ${timeStr}`;
        })
        .join(' → ');

      const summaryWithFare = totalPayment
        ? `${summary} (총 요금 ${totalPayment}원)`
        : summary;

      // vehicleArray 생성
      const vehicleArray = routeDetails.map(r => r.이동수단);

      //출발시간, 도착시간, 환승대기시간
      // ✅ 모든 환승쌍을 펼침
      const allTransfersFlat = transformed.flat();

      // ✅ 출발/도착 시간 배열 추출
      let realFromArray = [];
      let realToArray = [];

      if (transformed.length > 0 && !Array.isArray(transformed[0])) {
        // 환승이 한 번만 있는 경우
        realFromArray = transformed.map(t => t.realFrom);
        realToArray = transformed.map(t => t.realTo);
      } else {
        // 환승이 2번 이상인 경우
        const firstGroup = transformed[0] || [];
        const lastGroup = transformed[transformed.length - 1] || [];

        realFromArray = firstGroup.map(t => t.realFrom);
        realToArray = lastGroup.map(t => t.realTo);
      }


      // ✅ 환승대기시간 그룹별 배열 (네가 원하는 규칙)
      let waitMinutesArray = [];

      if (transformed.length > 0 && !Array.isArray(transformed[0])) {
        waitMinutesArray = transformed.map(t => [t.waitMinutes]);
      } else {
        const groupsWait = transformed.map(group =>
          group.map(t => t.waitMinutes)
        );
        waitMinutesArray = transpose(groupsWait);
      }

      // ✅ 최종 응답
      return res.json({
        summary: summaryWithFare,
        result: {
          경로: {
            "이동수단": vehicleArray,
            "출발 시간": realFromArray,
            "도착 시간": realToArray,
            "환승 대기 시간": waitMinutesArray,
            "총 소요 시간": totalTime || null,
            "요금": totalPayment || null,
            "세부 경로": routeDetails
          },
        },
        //transfers: transformed,
        groupedTransfers: groupedTransfers // ✅ 여기에 추가
      });

    } catch (err) {
      console.error('❌ 에러:', err.response?.data || err.message);
      res.status(500).json({ error: '서버 에러', detail: err.response?.data || err.message });
    }
  });

  //지하철 시간표 가져오기 ODSAY API 사용
  async function getSubwatSchedule(stationID, wayCode){
    const url = "https://api.odsay.com/v1/api/searchSubwaySchedule"
    try {
      const response = await axios.get(url,{
        params:{
          apiKey: API_KEY,
          stationID : stationID,
          showExpressTime : 1,
          wayCode : wayCode
        }
      })
      return response;
    } catch (error) {
      throw error
    }
  }

  //시:분 -> 분 으로 변환
  function timeToMinutes(timeStr) {
    const [hh, mm] = timeStr.split(":").map(Number);
    return hh * 60 + mm;
  }

  // 분 -> 시:분 문자열로 변경
  function minutesToTime(minutes){
    const hh = Math.floor(minutes/60)
    const mm = minutes%60
    return (`${hh}:${mm}`)
  }


  // A 열차 도착 직후 B 열차가 언제 있는지 찾아서 두 열차 간 대기시간 구함
  function getAllMinWaitPairs(scheduleA, scheduleB, fromSection, toSection) {
    const aMinutes = scheduleA.map(timeToMinutes);
    const bMinutes = scheduleB.map(timeToMinutes);

    const results = [];

    for (let i = 0; i < aMinutes.length; i++) {
      const aTime = aMinutes[i];

      const bMatch = bMinutes.find(bTime => bTime >= aTime);
      if (bMatch !== undefined) {
        const waitMinutes = bMatch - aTime;
        if(waitMinutes >= 3){
          results.push({
            from: minutesToTime(aTime),
            to: minutesToTime(bMatch),
            waitMinutes: bMatch - aTime,
            fromLine: fromSection?.subwayCode || null,
            fromStation: fromSection.endName,
            toLine: toSection?.subwayCode || null,
            toStation: toSection.startName
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

  /**
   * get-root의 환승대기시간 로직을 통째로 함수화
   *
   * @param {Array} result - 지하철 구간 목록
   * @returns {Promise<Array>} transfers
   */
  async function getRootTransfers(result) {
    const MIN_WAIT_TIME = 180;

    let allTransfers = [];
    let dep2 = [];

    if (result.length === 2) {
      const { data: schedule1 } = await getSubwatSchedule(result[0].endID, result[0].wayCode);
      const { data: schedule2 } = await getSubwatSchedule(result[1].startID, result[1].wayCode);

      const dayType = "weekdaySchedule";
      const dep1 = extractDepartureTimes(schedule1, result[0].wayCode);
      dep2 = extractDepartureTimes(schedule2, result[1].wayCode);

      const allWaitPairs = getAllMinWaitPairs(dep1, dep2, result[0], result[1]);
      const useFromAsKey =  dep1.length < dep2.length;
      const uniqueWaitPairs = getUniqueMinWaits(allWaitPairs, useFromAsKey);

      allTransfers = uniqueWaitPairs;

    } else if (result.length === 3) {
      const { data: schedule1 } = await getSubwatSchedule(result[0].endID, result[0].wayCode);
      const { data: schedule2 } = await getSubwatSchedule(result[1].startID, result[1].wayCode);
      const { data: schedule3 } = await getSubwatSchedule(result[2].startID, result[2].wayCode);

      const dayType = "weekdaySchedule";
      const dep1 = extractDepartureTimes(schedule1, result[0].wayCode);
      dep2 = extractDepartureTimes(schedule2, result[1].wayCode);
      const dep3 = extractDepartureTimes(schedule3, result[2].wayCode);

      if (dep1.length === 0 || dep2.length === 0 || dep3.length === 0 ) {
        console.error(`❌ Some schedules missing. Skipping transfer calculation.`);
        return [];
      }
      
      const pairs1 = getAllMinWaitPairs(dep1, dep2, result[0], result[1]);
      const pairs2 = getAllMinWaitPairs(dep2, dep3, result[1], result[2]);

      const useFromAsKey = dep2.length < dep3.length;
      const unique1 = getUniqueMinWaits(pairs1, useFromAsKey);
      const unique2 = getUniqueMinWaits(pairs2, !useFromAsKey);

      allTransfers = [unique1, unique2];
    }
    
    return {
      transfers: allTransfers,
      dep2: dep2 || []
    };

  }

  //출발시간 구할 때 시간 뺄셈 함수
  function subtractMinutesFromTime(baseTime, minutesToSubtract) {
    const [h, m] = baseTime.split(':').map(Number);
    let total = h * 60 + m - minutesToSubtract;
    if (total < 0) total += 24 * 60;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  //도착 시간 구할 때 시간 덧셈 함수
  function addMinutesToTime(baseTime, minutesToAdd) {
    const [h, m] = baseTime.split(':').map(Number);
    let total = h * 60 + m + minutesToAdd;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }


  //출발 시간 배열
  function extractDepartureTimes(schedule, wayCode) {
    const dayType = "weekdaySchedule";
    const dir = wayCode === 1 ? 'up' : 'down';

    const arr = schedule?.result?.[dayType]?.[dir];
    if (!arr || !Array.isArray(arr)) {
      console.error(`🚨 No schedule found for direction: ${dir}`);
      return [];
    }

    return arr.map(item => item.departureTime);
  }


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
      const sectionTimesBefore = getSectionTimesBefore(subPaths, transferIndex);
      const sectionTimesAfter = getSectionTimesAfter(subPaths, transferIndex);

      return [
        transfers.map(t => {
          const totalBefore = sectionTimesBefore.reduce((a, b) => a + b, 0);
          const totalAfter = sectionTimesAfter.reduce((a, b) => a + b, 0);

          const realFrom = subtractMinutesFromTime(t.from, totalBefore);
          const realTo = t.to;

          return {
            from: t.from,
            to: t.to,
            waitMinutes: t.waitMinutes,
            realFrom,
            realTo
          };
        })
      ];
    }
    // case 2: 세 구간 → transfers는 [ [...], [...] ]
    else {
        let transformed = [];

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
              const sectionTimesBefore = getSectionTimesBefore(subPaths, transferIndex);
              const totalBefore = sectionTimesBefore.reduce((a, b) => a + b, 0);

              newFrom = t.from;
              realFrom = subtractMinutesFromTime(t.from, totalBefore);
              newTo= t.to;
              realTo = t.to;

              //첫번째 환승의 to 저장
              prevToArr[tIdx] = t.to;

            } else {
              // 두 번째 환승

              // prevTo = 첫 번째 환승의 to
              const prevTo = prevToArr[tIdx];
              if (!prevTo) {
                console.error("🚨 이전 환승 realTo 값이 없습니다. 기본값으로 대체합니다.");
                continue;
              }

              // 두 번째 구간 소요시간
              const currentSection = subPaths[transferIndex + groupIdx];
              const currentSectionTime = currentSection?.sectionTime || 0;

              // prevTo + 구간 소요 시간 = 두 번째 열차 도착 시각
              const secondTrainArrival = addMinutesToTime(prevTo, currentSectionTime);

              // 이 도착 시각 이후에 탈 수 있는 열차 찾아야 함
              const nextTrain = dep2.find(timeStr => {
                const diff = timeToMinutes(timeStr) - timeToMinutes(secondTrainArrival);
                return diff >= 3;
              });

              if (!nextTrain) {
                console.error(`${secondTrainArrival} 이후 열차 없음. 건너뜀.`);
                continue;
              }

              // 두 번째 환승 구간의 from → 두 번째 열차 도착 시각
              newFrom = secondTrainArrival;

              // 두 번째 환승 구간의 to → 세 번째 열차 출발 시각
              newTo = nextTrain;

              // 실제 waitMinutes 계산
              waitMinutes = timeToMinutes(newTo) - timeToMinutes(newFrom);
              if (waitMinutes < 0) waitMinutes += 24 * 60; // 자정 넘을 경우 방어

              // realFrom, realTo
              realFrom = newFrom;
              realTo = addMinutesToTime(newTo, totalAfter);
            }

            transformedGroup.push({
              transferNo: groupIdx + 1,
              from: newFrom,
              to: newTo,
              waitMinutes: (groupIdx === 1) ? waitMinutes : t.waitMinutes,
              fromLine: t.fromLine,
              fromStation: t.fromStation,
              toLine: t.toLine,
              toStation: t.toStation,
              realFrom: realFrom,
              realTo: realTo
            });
          }

          transformed.push(transformedGroup);
        }

        return transformed;
          
      }
  }

  //행렬을 행-열 뒤집어서 세로 → 가로로, 가로 → 세로로 바꿔준다
  function transpose(matrix) {
    if (matrix.length === 0) return [];
    return matrix[0].map((_, colIndex) =>
      matrix.map(row => row[colIndex])
    );
  }



  module.exports = router;