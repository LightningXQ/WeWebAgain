const express = require('express');
const router = express.Router();

// 하위 라우터
const authRouter = require('./authRouter');   // /api/auth/...
const transferRouter = require('./transferRouter'); // /api/transfer/transfer-wait-times

// 필요시 ID 중복 확인(기존 유지)
const authRepo = require('../repository/authRepo');

// 디버그(선택)
console.log('[apiRouter] mount /auth -> authRouter');
console.log('[apiRouter] mount /transfer -> rootRouter');

// ✅ ID 중복 확인
router.get('/idcheck/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const userInfo = await authRepo.getUserById(id);
    if (userInfo.length > 0) {
      return res.json({ check: false });
    } else {
      return res.json({ check: true });
    }
  } catch (error) {
    console.error('ID 중복 확인 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ✅ 하위 라우터 마운트
router.use('/auth', authRouter);
router.use('/transfer', transferRouter);

module.exports = router;
