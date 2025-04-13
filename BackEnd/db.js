// db/db.js
const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'webagain-db.ctg002k6i7pc.ap-northeast-2.rds.amazonaws.com',
  user: 'admin',
  password: '12345678',
  database: 'webagain'
});

db.connect(err => {
  if (err) {
    console.error('❌ DB 연결 실패:', err);
  } else {
    console.log('✅ DB 연결 성공');
  }
});

module.exports = db;
