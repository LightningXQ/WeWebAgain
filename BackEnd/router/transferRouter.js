const express = require('express');
const router = express.Router();

const { computeTransferWaitTimes } = require('../services/transferService');
const { resolveDayType } = require('../utils/normalize');

router.use(express.json());

router.post('/transfer-wait-times', async (req, res) => {
  try {
    const { sx, sy, ex, ey, dayType, pathIndex = 0 } = req.body || {};

    // 1) 필수값 검증
    if (sx == null || sy == null || ex == null || ey == null) {
      return res.status(400).json({ error: 'sx, sy, ex, ey는 필수입니다.' });
    }

    // 2) 요일 타입 정규화 (평일/토/일/공휴 → 내부 키)
    const day = resolveDayType(dayType);

    // 3) 서비스 호출
    const payload = await computeTransferWaitTimes({ sx, sy, ex, ey, day, pathIndex });

    // 4) 응답
    return res.json(payload);
  } catch (err) {
    console.error('❌ transfer-wait-times error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: '서버 에러', detail: err?.response?.data || err?.message || String(err) });
  }
});

module.exports = router;
