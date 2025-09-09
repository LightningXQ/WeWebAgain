// ✅ server.js (완성 버전)
require('dotenv').config();  // ← 반드시 최상단
const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const cors = require('cors');
const db = require('./db.js');

// ⬇️ [추가] 버스 CSV 1회 로딩을 위한 의존성
const path = require('node:path');
const { loadBusCSVsFromDir, busTimetables } = require('./loader/bustimetable');

// (선택) .env를 쓰는 경우에만 활성화
// require('dotenv').config();

// 🔗 하위 라우터는 apiRouter 하나만 마운트
const apiRouter = require('./router/apiRouter');
const transferRouter = require('./router/transferRouter.js');
const authRouter = require('./router/authRouter.js');

const app = express();
const port = 4000;

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

// ⬇️⬇️⬇️ [추가] 서버 시작 시 버스 CSV 1회 로딩
(async () => {
  try {
    // CSV가 있는 실제 경로로 맞춰줘: 예) BACKEND/data/bus
    const dataDir = path.join(__dirname, 'data', 'bus');
    await loadBusCSVsFromDir(dataDir);
    console.log('✅ 버스 CSV 로딩 완료, 라우트 수:', Object.keys(busTimetables).length);
  } catch (e) {
    console.error('❌ 버스 CSV 로딩 실패:', e);
  }
})();
// ⬆️⬆️⬆️ [추가 끝]

// ✅ 라우터: /api 로 통합 마운트
app.use('/api', apiRouter);
app.use('/transfer', transferRouter)
app.use('/auth', authRouter)

// 테스트용 API
app.get('/', (req, res) => {
  res.send('백엔드 서버 실행 중');
});

// ✅ 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 http://localhost:${port} 에서 실행 중`);
});
