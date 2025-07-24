const express = require('express');
const axios = require('axios');
const router = express.Router();
const API_KEY = 'tEBVEVC41PifgZPs+s7rTsaACXx0gBHXENLk8PE0MvQ';
const key = 'bMsEnYaDn0XNAYckid01FD41G001MjD8sv8omBBUHSOo5ZYweAoLmwLeb/a3GAVb/+ZgL3n29wO1LAw4bM+Bzw=='
router.use(express.json());
const xml2js = require('xml2js');
const busRepo = require('../repository/busRepo')

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

module.exports = router;