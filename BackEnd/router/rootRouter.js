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

      const path = pathRes.data.result.path[0];
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
          subwayCode: item.lane?.[0]?.subwayCode || null,
          sectionTime: item.sectionTime || 0,
          subPath: item // ← 요 부분 추가
        }));

        console.log("🧾 result 전달값:", result);
        console.log("📏 result.length:", result.length);

      // 예) 환승 인덱스
      const transferIndex = 2;

      const {transfers, dep2 } = await getRootTransfers(result);
      
      const t = transfers.find(x => x.waitMinutes >= 5); //혹시 모를 대비로 5분 이상
      const transformed = transformT(transfers, subPaths, transferIndex, dep2);

      // ✅ groupedTransfers 만들어줌
      let groupedTransfers = [];

      if (transformed.length >= 2) {
        for (let i = 0; i < transformed[0].length; i++) {
          groupedTransfers.push({
            transfer1: transformed[0][i],
            transfer2: transformed[1]?.[i] || null
          });
        }
      } else if (transformed.length === 1) {
        for (let i = 0; i < transformed[0].length; i++) {
          groupedTransfers.push({
            transfer1: transformed[0][i],
            transfer2: null
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
            이동시간: typeof time === 'number' ? `${time}` : time,
            이동거리: distance !== null ? `${distance}` : null,
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
              이동시간: typeof time === 'number' ? `${time}` : time,
              이동거리: distance !== null ? `${distance}` : null,
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
          이동시간: typeof time === 'number' ? `${time}` : time,
          이동거리: distance !== null ? `${distance}` : null
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

  // ✅ 노선명 비교를 위한 정규화 함수
  function normalizeLineName(name) {
    return name.replace(/\s/g, '')
              .replace(/도시철도/g, '')
              .replace(/호선/g, '')
              .trim();
  }

    // ✅ ODCloud API 기반 부산지하철 전체 시간표 (1~4호선 전부) 가져오기
    async function getSubwayScheduleByODCloud(stationName, nextStationName, lineName, dayType) {
    const baseUrl = `https://api.odcloud.kr/api/15082980/v1/uddi:f289c185-dd70-46ef-894f-faa0713559c2`;
    const serviceKey = "hQpihHgA0fkA5V+YMXlwFnWolJN4AaoNa0m9bB1wKdzECLvcBu/ZZo6kDIzN/vXlH7s1h3zrDvvb4YyEEemZpA==" // 네 키
    const allData = [];

    for (let page = 1; page <= 5; page++) {
      const url = `${baseUrl}?serviceKey=${encodeURIComponent(serviceKey)}&page=${page}&perPage=500`;
      try {
        const res = await axios.get(url);
        allData.push(...res.data.data);
        if (res.data.currentCount < 500) break;
      } catch (err) {
        console.error("❌ ODCloud 요청 실패:", err.message);
        break;
      }
    }

    const filtered = allData.filter(train => 
      normalizeLineName(train.노선명) === normalizeLineName(lineName) &&
      train.요일구분 === dayType
    );

    const times = [];

    for (const train of filtered) {
      const stationList = train.운행구간정거장?.split('+')?.map(x => x.split('-')[1]);
      const stationTimes = train.정거장출발시각?.split('+')?.map(x => x.split('-')[1]);

      if (!stationList || !stationTimes) continue;

      const idx = stationList.indexOf(stationName);
      if (idx !== -1 && stationList[idx + 1] === nextStationName) {
        const t = stationTimes[idx];
        // ✅ 05:00 이전/24:00 이후 컷
        if (isWithinServiceHHMM(t)) {
          times.push(t);
        }
      }
    }

    return times.sort(); // 시간 정렬
  }

  // ✅ 운행 시간대(서비스 윈도우): 05:00 ~ 24:00
  const SERVICE_START_MIN = 5 * 60;      // 05:00
  const SERVICE_END_MIN   = 24 * 60;     // 24:00 (자정)


  //시:분 -> 분 으로 변환
  function timeToMinutes(timeStr) {
    const [hh, mm] = timeStr.split(":").map(Number);
    return hh * 60 + mm;
  }

  // 분 -> 시:분 문자열로 변경
  function minutesToTime(minutes){
    // 24시간 롤오버 및 음수 보정
    minutes = ((minutes % (24*60)) + (24*60)) % (24*60);
    const hh = String(Math.floor(minutes/60)).padStart(2, '0');
    const mm = String(minutes%60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // ✅ “시:분”이 서비스 윈도우 안에 있는지 확인
  function isWithinServiceHHMM(hhmm) {
    const m = timeToMinutes(hhmm);
    return m >= SERVICE_START_MIN && m <= SERVICE_END_MIN;
  }

  // ✅ “분”값(정수)이 서비스 윈도우 안에 있는지 확인
  function isWithinServiceMin(mins) {
    mins = ((mins % (24*60)) + (24*60)) % (24*60);
    return mins >= SERVICE_START_MIN && mins <= SERVICE_END_MIN;
  }


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
            waitMinutes: waitMinutes,
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
    let allTransfers = [];
    let dep2 = [];
  
    // ✅ subPaths 강제 생성 (기존의 잘못된 subPath 접근 제거)
    const subPaths = result.map(r => ({
      lane: [{ name: r.startName + "→" + r.endName, subwayCode: r.subwayCode }],
      passStopList: {
        stations: [
          { stationName: r.startName },
          { stationName: r.endName }
        ]
      },
      endName: r.endName
    }));

    if (result.length === 2) {
      const subPaths = [result[0].subPath, result[1].subPath];

      const dep1SubPath = subPaths[0];
      const dep2SubPath = subPaths[1];

      // ✅ 이 아래에 추가
      console.log("📦 dep1SubPath:", dep1SubPath);
      console.log("📦 dep2SubPath:", dep2SubPath);

      const stations1 = dep1SubPath?.passStopList?.stations || [];
      const stations2 = dep2SubPath?.passStopList?.stations || [];

      console.log("🔍 stations1 내용:", stations1);
      console.log("📋 stations1 역이름 목록:", stations1.map(s => s.stationName));
      console.dir(stations1, { depth: null });

      console.log("🧪 stations1.length:", stations1.length);
      console.log("🧪 stations2.length:", stations2.length);

      if (stations1.length >= 2 && stations2.length >= 2) {
        const station1 = dep1SubPath.startName;
        const stationList1 = stations1.map(s => s.stationName);
        const nextStation1 = stationList1[stationList1.indexOf(station1) + 1];
      
        const station2 = dep2SubPath.startName;
        const stationList2 = stations2.map(s => s.stationName);
        const nextStation2 = stationList2[stationList2.indexOf(station2) + 1];

        const line1 = dep1SubPath.lane?.[0]?.name;
        const line2 = dep2SubPath.lane?.[0]?.name;

        const dayType = "평일";

        console.log("🚇 ODCloud 호출 인자 확인:");
        console.log("🔹 station1:", station1, "| nextStation1:", nextStation1, "| line1:", line1);
        console.log("🔹 station2:", station2, "| nextStation2:", nextStation2, "| line2:", line2);
        console.log("🗓️ dayType:", dayType);

        const dep1Raw = await getSubwayScheduleByODCloud(station1, nextStation1, line1, dayType);
        const dep2Raw = await getSubwayScheduleByODCloud(station2, nextStation2, line2, dayType);

        console.log("🔁 dep1Raw:", dep1Raw);
        console.log("🔁 dep2Raw:", dep2Raw);

        const dep1 = dep1Raw;
        dep2 = dep2Raw;

        const allWaitPairs = getAllMinWaitPairs(dep1, dep2, result[0], result[1]);
        const useFromAsKey = dep1.length < dep2.length;
        const uniqueWaitPairs = getUniqueMinWaits(allWaitPairs, useFromAsKey);

        allTransfers = uniqueWaitPairs;
      }

    } else if (result.length === 3) {
      const subPaths = [result[0].subPath, result[1].subPath, result[2].subPath];

      const dep1SubPath = subPaths[0];
      const dep2SubPath = subPaths[1];
      const dep3SubPath = subPaths[2];

      const stations1 = dep1SubPath?.passStopList?.stations || [];
      const stations2 = dep2SubPath?.passStopList?.stations || [];
      const stations3 = dep3SubPath?.passStopList?.stations || [];

      if (stations1.length >= 2 && stations2.length >= 2 && stations3.length >= 2) {
        const station1 = dep1SubPath.startName;
        const stationList1 = stations1.map(s => s.stationName);
        const nextStation1 = stationList1[stationList1.indexOf(station1) + 1];

        const station2 = dep2SubPath.startName;
        const stationList2 = stations2.map(s => s.stationName);
        const nextStation2 = stationList2[stationList2.indexOf(station2) + 1];

        const station3 = dep3SubPath.startName;
        const stationList3 = stations3.map(s => s.stationName);
        const nextStation3 = stationList3[stationList3.indexOf(station3) + 1];

        const line1 = dep1SubPath.lane?.[0]?.name;
        const line2 = dep2SubPath.lane?.[0]?.name;
        const line3 = dep3SubPath.lane?.[0]?.name;

        const dayType = "평일";

        const dep1Raw = await getSubwayScheduleByODCloud(station1, nextStation1, line1, dayType);
        const dep2Raw = await getSubwayScheduleByODCloud(station2, nextStation2, line2, dayType);
        const dep3Raw = await getSubwayScheduleByODCloud(station3, nextStation3, line3, dayType);

        const dep1 = dep1Raw;
        dep2 = dep2Raw;
        const dep3 = dep3Raw;

        if (dep1.length === 0 || dep2.length === 0 || dep3.length === 0) {
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
          const realTo = addMinutesToTime(t.to, totalAfter);

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

              const currentSectionTime = subPaths[transferIndex]?.sectionTime || 0;
              
              // 🟡 원래 from은 dep1 출발 시각인데 → 여기에 currentSectionTime(소요 시간) 더해줘야 도착시각이 됨
              const fromTrainDeparture = t.from;
              const fromTrainArrival = addMinutesToTime(fromTrainDeparture, currentSectionTime);

              newFrom = t.from;
              realFrom = subtractMinutesFromTime(newFrom, totalBefore);

              newTo = t.to;
              realTo = t.to;

              prevToArr[tIdx] = t.to; // 그대로 유지

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