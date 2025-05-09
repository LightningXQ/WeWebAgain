const express = require('express');
const router = express.Router();
const authRepo = require('../repository/authRepo');
const bcrypt = require('bcrypt');

// 🔹 회원가입
router.post('/signup', async (req, res) => {
  const { userId, username, password, email } = req.body;

  // 비밀번호 유효성 검사
  const isValidPassword = /^[A-Za-z0-9]{8,}$/.test(password);
  if (!isValidPassword) {
    return res.status(400).send('비밀번호는 영문+숫자 조합 8자 이상이어야 합니다.');
  }

  try {
    const existingUser = await authRepo.getUserById(userId);
    if (existingUser.length > 0) {
      return res.status(400).send('이미 존재하는 아이디입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    await authRepo.signup(userId, hashedPassword, username, email, now);

    res.send('회원가입 성공');
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).send('회원가입 실패');
  }
});

// 🔹 로그인
router.post('/login', async (req, res) => {
  const { userId, password } = req.body;

  try {
    const users = await authRepo.getUserById(userId);
    if (users.length === 0) {
      return res.status(401).send('아이디 또는 비밀번호 오류');
    }

    const match = await bcrypt.compare(password, users[0].password);
    if (!match) return res.status(401).send('아이디 또는 비밀번호 오류');

    req.session.user = {
      id: users[0].id,
      username: users[0].username,
      email: users[0].email
    };

    res.send('로그인 성공');
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).send('로그인 실패');
  }
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
