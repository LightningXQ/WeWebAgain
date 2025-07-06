const express = require('express');
const axios = require('axios');
const router = express.Router();
const API_KEY = 'IYCEsHB+QAVMoiYiqW6CVU3DdBoV1YAG3IQmmpYIZE8';
const fetch = require('node-fetch');

router.use(express.json());

router.get('/get-root', async (req, res) => {
  const { sx, sy, ex, ey } = req.query;

  if (!sx || !sy || !ex || !ey) {
    return res.status(400).json({ error: '쿼리 파라미터 sx, sy, ex, ey가 필요합니다.' });
  }
  try {
    const data = await getRoot(sx,sy,ex,ey);
    const path1 = data.result.path[0].subPath
    
    const result = path1
      .filter(item => item.trafficType === 1)
      .map(item => ({
        startName: item.startName,
        startID: item.startID,
        endName: item.endName,
        endID: item.endID,
        wayCode : item.wayCode
      }));    


    if(result.length == 2){
      const {data:schedule1} = await getSubwatSchedule(result[0].endID, result[0].wayCode)
      const {data:schedule2} = await getSubwatSchedule(result[1].startID, result[1].wayCode)

      const dayType = "weekdaySchedule"
      const departureTimes1 =  schedule1.result[dayType][result[0].wayCode === 1 ? 'up' : 'down']
      .map(item=>item.departureTime)
      const departureTimes2 =  schedule2.result[dayType][result[1].wayCode === 1 ? 'up' : 'down']
      .map(item=>item.departureTime)
      const allWaitPairs = getAllMinWaitPairs(departureTimes1, departureTimes2);
      
      const useFromAsKey = departureTimes1.length < departureTimes2.length;
      const uniqueWaitPairs = getUniqueMinWaits(allWaitPairs, useFromAsKey);
      
      res.json({ transfers: uniqueWaitPairs });
    }
    else if(result.length == 3){
      const { data: schedule1 } = await getSubwatSchedule(result[0].endID, result[0].wayCode);
      const { data: schedule2 } = await getSubwatSchedule(result[1].startID, result[1].wayCode);
      const { data: schedule3 } = await getSubwatSchedule(result[1].endID, result[1].wayCode);
      const { data: schedule4 } = await getSubwatSchedule(result[2].startID, result[2].wayCode);

      const dayType = "weekdaySchedule";
      const dep1 = schedule1.result[dayType][result[0].wayCode === 1 ? 'up' : 'down'].map(item => item.departureTime);
      const dep2 = schedule2.result[dayType][result[1].wayCode === 1 ? 'up' : 'down'].map(item => item.departureTime);
      const dep3 = schedule3.result[dayType][result[1].wayCode === 1 ? 'up' : 'down'].map(item => item.departureTime);
      const dep4 = schedule4.result[dayType][result[2].wayCode === 1 ? 'up' : 'down'].map(item => item.departureTime);

      // 1차 환승: 지하철 1 → 지하철 2
      const pairs1 = getAllMinWaitPairs(dep1, dep2);
      // 2차 환승: 지하철 2 → 지하철 3
      const pairs2 = getAllMinWaitPairs(dep3, dep4);

      // 중복 제거 기준은 가운데(지하철 2) 기준으로: from 또는 to를 기준으로 병합
      const useFromAsKey = dep2.length < dep3.length;
      const unique1 = getUniqueMinWaits(pairs1, useFromAsKey);
      const unique2 = getUniqueMinWaits(pairs2, !useFromAsKey);

      return res.json({ transfers: [...unique1, ...unique2] });
    }
  } catch (error) {
    console.error('❌ 에러 in /get-root:', error.message);
    res.status(500).json({ error: '서버 오류 발생', detail: error.message });
  }
});

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

    const path = pathRes.data.result.path[0];
    const subPaths = path.subPath;
    const totalPayment = path.info?.payment;
    const totalTime = path.info?.totalTime;

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
        time = "환승통로";
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

    // 환승 대기시간도 그대로 계산
    const transfers = await calculateTransferWaitTimes(subPaths);

    // ✅ 최종 응답
    return res.json({
      summary: summaryWithFare,
      result: {
        경로: {
          "총 소요 시간": totalTime || null,
          "요금": totalPayment || null,
          "세부 경로": routeDetails
        },
      },
      transfers
    });

  } catch (err) {
    console.error('❌ 에러:', err.response?.data || err.message);
    res.status(500).json({ error: '서버 에러', detail: err.response?.data || err.message });
  }
});






// 🧠 환승 대기시간 계산 함수
async function calculateTransferWaitTimes(subPaths) {
  const transfers = [];
  let timeAccumulator = 0;
  let prev = null;

  for (const curr of subPaths) {
    if (curr.trafficType === 3) {
      timeAccumulator += curr.sectionTime || 0;
      continue;
    }

    if (prev) {
      const isTransfer =
        prev.trafficType !== curr.trafficType ||
        getVehicleName(prev) !== getVehicleName(curr);

      if (isTransfer && curr.trafficType === 1 && curr.startID && curr.wayCode !== undefined) {
        const arrivalTime = addMinutesToTime('09:00', timeAccumulator);
        const waitMin = await getSubwayWaitTime(curr.startID, curr.wayCode, arrivalTime);

        transfers.push({
          from: getVehicleName(prev),
          to: getVehicleName(curr),
          predictedArrival: arrivalTime,
          waitMinutes: waitMin
        });
      }
    }

    timeAccumulator += curr.sectionTime || 0;
    prev = curr;
  }

  return transfers;
}

// 🚇 지하철 시간표 조회
async function getSubwayWaitTime(stationID, wayCode, arrivalTime) {
  try {
    const res = await axios.get('https://api.odsay.com/v1/api/searchSubwaySchedule', {
      params: {
        apiKey: API_KEY,
        stationID,
        wayCode,
        showExpressTime: 1
      }
    });

    console.log('📦 시간표 응답:', JSON.stringify(res.data, null, 2));
    console.log(`📍 요청 정보: stationID=${stationID}, wayCode=${wayCode}, 예상도착=${arrivalTime}`);

    const timetableByHour = res.data.result?.OrdList?.[wayCode === 1 ? "up" : "down"]?.time;

    if (!Array.isArray(timetableByHour)) {
      console.warn('🚫 시간표 항목이 배열이 아님:', res.data.result);
      return null;
    }

    const [arrH, arrM] = arrivalTime.split(':').map(Number);
    const arrMinutes = arrH * 60 + arrM;

    for (const { Idx, list } of timetableByHour) {
      const hour = parseInt(Idx, 10);
      if (isNaN(hour) || hour < arrH) continue;

      const minutes = list.match(/\d{2}/g)?.map(m => parseInt(m, 10));
      if (!minutes) continue;

      for (const min of minutes) {
        const totalMin = hour * 60 + min;
        if (totalMin >= arrMinutes) {
          return totalMin - arrMinutes;
        }
      }
    }

    return null;
  } catch (err) {
    console.error('🔻 시간표 조회 실패:', err.message);
    return null;
  }
}

// ⏱ 시간 더하기 함수
function addMinutesToTime(baseTime, minutesToAdd) {
  const [h, m] = baseTime.split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 교통수단 이름
function getVehicleName(section) {
  if (section.trafficType === 1) return section.lane?.[0]?.name || '지하철';
  if (section.trafficType === 2) return section.lane?.[0]?.busNo || '버스';
  return '도보';
}

async function getRoot(sx, sy, ex, ey) {
  const url = 'https://api.odsay.com/v1/api/searchPubTransPathT';

  try {
    const response = await axios.get(url, {
      params: {
        apiKey: API_KEY,
        lang: 0,
        SX: sx,
        SY: sy,
        EX: ex,
        EY: ey,
        // SearchPathType : 1
      }
    });

    return response.data;
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('ODsay API 호출 실패:', detail);
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
}

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


function timeToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  return hh * 60 + mm;
}
function minutesToTime(minutes){
  const hh = Math.floor(minutes/60)
  const mm = minutes%60
  return (`${hh}:${mm}`)
}


function getAllMinWaitPairs(scheduleA, scheduleB) {
  const aMinutes = scheduleA.map(timeToMinutes);
  const bMinutes = scheduleB.map(timeToMinutes);

  const results = [];

  for (let i = 0; i < aMinutes.length; i++) {
    const aTime = aMinutes[i];

    const bMatch = bMinutes.find(bTime => bTime >= aTime);
    if (bMatch !== undefined) {
      results.push({
        from: minutesToTime(aTime),
        to: minutesToTime(bMatch),
        waitMinutes: bMatch - aTime
      });
    }
  }

  return results;
}

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

module.exports = router;