// ✅ /router/authRouter.js (id를 userId로 사용 + 비밀번호 유효성 검사 + 중복 ID 체크 + 이메일 저장 추가)
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// 🔹 회원가입
router.post('/signup', async (req, res) => {
  const { userId, username, password, email } = req.body;

  // 비밀번호 유효성 검사 (영문+숫자 8자 이상)
  const isValidPassword = /^[A-Za-z0-9]{8,}$/.test(password);
  if (!isValidPassword) {
    return res.status(400).send('비밀번호는 영문+숫자 조합 8자 이상이어야 합니다.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  const sql = 'INSERT INTO user (id, username, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [userId, username, email, hashedPassword, now, now];

  db.query(sql, values, (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).send('이미 존재하는 아이디입니다.');
      }
      console.error('회원가입 실패:', err);
      return res.status(500).send('회원가입 오류');
    }
    res.send('회원가입 성공');
  });
});

// 🔹 로그인 (id를 userId로 조회)
router.post('/login', (req, res) => {
  const { userId, password } = req.body;

  db.query('SELECT * FROM user WHERE id = ?', [userId], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).send('아이디 또는 비밀번호 오류');
    }

    const match = await bcrypt.compare(password, results[0].password);
    if (!match) return res.status(401).send('아이디 또는 비밀번호 오류');

    // 세션 저장
    req.session.user = {
      id: results[0].id,
      username: results[0].username,
      email: results[0].email
    };

    res.send('로그인 성공');
  });
});

// 🔹 로그인 상태 확인
router.get('/check', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// 🔹 로그아웃
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.send('로그아웃 완료');
});

module.exports = router;
  
