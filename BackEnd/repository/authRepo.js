// C:\github\webagain\BackEnd\repository\authRepo.js
const db = require('../db');

module.exports = {
  // ✅ 회원가입 (Signup)
  signup: (id, password, name, email) => {
    return new Promise((resolve, reject) => {
      const sql = "INSERT INTO `webagain`.`user` (`id`, `email`, `username`, `password`) VALUES (?,?,?,?);";
      db.query(sql, [id, email, name, password], (err, results) => {
        if (err) {
          console.error('회원가입 DB 오류:', err);
          return reject(err);
        }

        console.log('회원가입 성공:', results);
        resolve(results);
      });
    });
  },

  // ✅ 사용자 조회 (Get User by ID)
  getUserById: (userId) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user WHERE id = ?';
      db.query(sql, [userId], (err, results) => {
        if (err) {
          console.error('DB 조회 오류:', err);
          return reject(err);
        }

        console.log('DB 조회 결과:', results);
        resolve(results);
      });
    });
  }
};
