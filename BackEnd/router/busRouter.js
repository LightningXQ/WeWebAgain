const express = require('express');
const axios = require('axios');
const router = express.Router();
const API_KEY = 'tEBVEVC41PifgZPs+s7rTsaACXx0gBHXENLk8PE0MvQ';
const key = 'bMsEnYaDn0XNAYckid01FD41G001MjD8sv8omBBUHSOo5ZYweAoLmwLeb/a3GAVb/+ZgL3n29wO1LAw4bM+Bzw=='
router.use(express.json());
const xml2js = require('xml2js');
const busRepo = require('../repository/busRepo')


router.get('/test/:bus_no', async(req, res)=>{
  const busNo = req.params.bus_no;
  const bus = await fetchBusInfo(busNo);
  //const busId = await fetchBusId(busNo);
  //const route = await fetchBusRoute(busNo)
  res.json(bus)
})
router.get('/getbus/:bus_no', async (req, res)=>{
  try {
    const busNo = req.params.bus_no;
    const route =await fetchBusRoute(busNo)
    route.forEach(node => {
      const {arsno, bstopidx} = node
    });
    res.send(route)
  } catch (error) {
    
  }
})

async function fetchStopInfo(stationId){ //정류장 위도경도 등
  const url = "http://apis.data.go.kr/6260000/BusanBIMS/busStopArrByBstopidLineid"
  try {
    const response = await axios.get(url,{
      params:{
        serviceKey: key,
        bstopid : stationId
      }
    })
    return response.data;
  } catch (error) {
    throw error
  }
}


async function fetchBusInfo(busNo){ //버스 배차시간
  const url = "http://apis.data.go.kr/6260000/BusanBIMS/busInfo"
  try {
    const busId = await fetchBusId(busNo);
    const response = await axios.get(url,{
      params:{
        serviceKey: key,
        lineid : busId,
        lineno : busNo
      }
    })
    const parser = new xml2js.Parser({ explicitArray: false });
    const res = await parser.parseStringPromise(response.data);
    const result = res.response.body.items.item;
    return result
  } catch (error) {
    throw error
  }
}

async function fetchBusInfoOdsay(busNo){ //버스 배차시간
  const url = "https://api.odsay.com/v1/api/busLaneDetail"
  try {
    const busId = '520' + String(busNo).padStart(4, '0') + '000';
    const response = await axios.get(url,{
      params:{
        apiKey: API_KEY,
        lang:1,
        lineid : busId,
        lineno : busNo
      }
    })
    const parser = new xml2js.Parser({ explicitArray: false });
    const res = await parser.parseStringPromise(response.data);
    const result = res.response.body.items.item;
    return result
  } catch (error) {
    throw error
  }
}

async function fetchBusId(busNo){ //버스 배차시간
  const url = "https://api.odsay.com/v1/api/searchBusLane"
  try {
    const response = await axios.get(url,{
      params:{
        apiKey: API_KEY,
        lang:1,
        busNo : busNo,
        CID : 7000,
        displayCnt : 1
      }
    })
    return response.data.result.lane[0].localBusID
  } catch (error) {
    throw error
  }
}


async function fetchBusRoute(busNo){ //버스 경로 정거장
  // const busId = await getBusId(busNo)
  const url = "http://apis.data.go.kr/6260000/BusanBIMS/busInfoByRouteId"
  try {
    const response = await axios.get(url,{
      params:{
        serviceKey: key,
        lineno : busNo
      }
    })
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    return result.response.body.items.item
  } catch (error) {
    throw error
  }
}



module.exports = router;