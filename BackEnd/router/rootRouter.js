const express = require('express');
const axios = require('axios');
const router = express.Router();
const API_KEY = 'tEBVEVC41PifgZPs+s7rTsaACXx0gBHXENLk8PE0MvQ';
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

    const {data:schedule1} = await getSubwatSchedule(result[0].endID, result[0].wayCode)
    const {data:schedule2} = await getSubwatSchedule(result[1].startID, result[0].wayCode)

    const dayType = "weekdaySchedule"
    const departureTimes1 = schedule1.result[dayType].up
    .map(item=>item.departureTime)
    const departureTimes2 =  schedule2.result[dayType].up
    .map(item=>item.departureTime)
    // const minTime = getMinWaitTime(departureTimes1, departureTimes2)

    res.send(departureTimes2)
  } catch (error) {
    throw(error)
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

    // 🗺️ 경로 요약 생성
    const summary = subPaths.map((p, i) => {
      let name = '';
      let time = p.sectionTime;

      // 환승 통로 감지: 도보 + 0분 + 앞뒤 모두 지하철
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
        time = 8; // 사용자 정의 환승 통로 시간
      } else if (p.trafficType === 1) {
        name = p.lane?.[0]?.name || '지하철';
      } else if (p.trafficType === 2) {
        name = p.lane?.[0]?.busNo || '버스';
      } else {
        name = '도보';
      }

      return `${name} ${time}분`;
    }).join(' → ');


    console.log('🗺️ 경로 요약:', summary);

    // 2. 환승 계산
    const result = await calculateTransferWaitTimes(subPaths);
    return res.json({ summary, transfers: result });

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

    const timetableByHour = res.data.result?.OrdList?.down?.time;

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


async function getMinWaitTime(scheduleA, scheduleB) {
  const aMinutes = scheduleA.map(timeToMinutes);
  const bMinutes = scheduleB.map(timeToMinutes);
  let memoI=0
  for(const bTime of scheduleB){
    for(i=memoI; i<aMinutes.length;i++){
      
    }
  }
}

module.exports = router;