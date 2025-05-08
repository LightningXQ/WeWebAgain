const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const port = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: 'my-secret-key',   // 세션 암호화 키
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }   // HTTPS 안 쓰면 false (로컬에서는 무조건 false)
}));

// MariaDB 연결 설정
const db = mysql.createConnection({
  host: 'webagain.c1sso6a8y8aj.ap-northeast-2.rds.amazonaws.com',
  user: 'admin',
  password: '12345678',
  database: 'webagain'
});

// DB 연결
db.connect((err) => {
  if (err) {
    console.error('❌ DB 연결 실패:', err);
    return;
  }
  console.log('✅ MariaDB 연결 성공');
});

// 기본 API
app.get('/', (req, res) => {
  res.send('백엔드 서버 실행 중');
});

// 사용자 전체 조회
app.get('/users', (req, res) => {
  db.query('SELECT * FROM user', (err, results) => {
    if (err) return res.status(500).send('DB 조회 오류');
    res.json(results);
  });
});

// ⭐ 회원가입 API
app.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = 'INSERT INTO user (email, password, username) VALUES (?, ?, ?)';
  db.query(sql, [email, hashedPassword, username], (err, result) => {
    if (err) {
      console.error('❌ 회원가입 오류:', err);
      return res.status(500).send('회원가입 실패');
    }
    res.status(201).send('회원가입 성공');
  });
});

// ⭐ 로그인 API (세션 저장 방식)
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM user WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).send('DB 오류');
    if (results.length === 0) return res.status(401).send('존재하지 않는 사용자');

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send('비밀번호 불일치');

    // 로그인 성공 → 세션 저장
    req.session.user = {
      id: user.Key,
      email: user.email
    };

    res.json({ message: '로그인 성공', user: req.session.user });
  });
});

// ⭐ 로그인된 사용자 정보 확인 API
app.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('로그인 안 되어 있음');
  }
  res.json({ user: req.session.user });
});

// ⭐ 로그아웃 API
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.send('로그아웃 완료');
});

// 서버 실행
app.listen(3000, '0.0.0.0', () => {
  console.log(`✅ 서버가 http://localhost/:3000 에서 실행 중`);
});
