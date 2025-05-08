// ✅ server.js (완성 버전)
const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const cors = require('cors');
const app = express();
const port = 4000;

const db = require('./db.js');
const authRouter = require('./router/authRouter.js');

// ✅ CORS 설정 (프론트엔드와 세션 공유 위해 필요)
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// ✅ 미들웨어 추가
app.use(express.json());
app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// ✅ DB 연결
db.connect((err) => {
  if (err) {
    console.error('❌ DB 연결 실패:', err);
    return;
  }
  console.log('✅ MariaDB 연결 성공');
});

// ✅ 라우터 등록
app.use('/auth', authRouter);

// 테스트용 API
app.get('/', (req, res) => {
  res.send('백엔드 서버 실행 중');
});

app.get('/users', (req, res) => {
  db.query('SELECT * FROM user', (err, results) => {
    if (err) {
      res.status(500).send('DB 조회 오류');
    } else {
      res.json(results);
    }
  });
});

// ✅ 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 http://localhost:${port} 에서 실행 중`);
});
