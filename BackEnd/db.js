// db/db.js
const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'newnew.c1sso6a8y8aj.ap-northeast-2.rds.amazonaws.com',            // 중요! 컨테이너 이름
  user: 'admin',
  password: '87654321',
  database: 'webagain_safe'
});

// db.connect(err => {
//   if (err) {
//     console.error('❌ DB 연결 실패:', err);
//   } else {
//     console.log('✅ DB 연결 성공');
//   }
// });

module.exports = db;
