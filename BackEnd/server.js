const express = require('express');
const mysql = require('mysql');
const app = express();
const port = 4000;
const db = require('./db.js');



// DB 연결 시도
db.connect((err) => {
  if (err) {
    console.error('❌ DB 연결 실패:', err);
    return;
  }
  console.log('✅ MariaDB 연결 성공');

});

// 간단한 API 테스트용
app.get('/', (req, res) => {
  res.send('백엔드 서버 실행 중');
});

// 예시: DB에서 데이터 가져오기
app.get('/users', (req, res) => {
  db.query('SELECT * FROM user', (err, results) => {
    if (err) {
      res.status(500).send('DB 조회 오류');
    } else {
      res.json(results);
    }
  });
});

app.listen(port, () => {
  console.log(`✅ 서버가 http://localhost:${port} 에서 실행 중`);
});
