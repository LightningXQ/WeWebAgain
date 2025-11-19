const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/save-route', (req, res) => {
    // 클라이언트(프론트엔드)에서 보낸 데이터 받기
    const { userId, route_name, start_name, sx, sy, dest_name, ex, ey, arrive_time } = req.body;

    // SQL 쿼리 작성 (created_at은 현재 시간인 NOW() 사용)
    const sql = `
        INSERT INTO saved_route 
        (user_id, route_name, start_name, sx, sy, dest_name, ex, ey, arrive_time, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // 쿼리에 들어갈 값 배열 (순서가 중요합니다)
    const params = [userId, route_name, start_name, sx, sy, dest_name, ex, ey, arrive_time];

    // DB 실행
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('경로 저장 중 에러 발생:', err);
            return res.status(500).json({ 
                success: false, 
                message: '데이터베이스 오류가 발생했습니다.' 
            });
        }

        // 성공 시 응답
        res.status(200).json({ 
            success: true, 
            message: '경로가 성공적으로 저장되었습니다.',
            routeId: result.insertId // 저장된 행의 PK(route_id)를 반환
        });
    });
});

router.post('/pop-route', (req, res) => {
    const { user_id } = req.body;

    // 1. user_id가 없는 경우 예외 처리
    if (!user_id) {
        return res.status(400).json({ 
            success: false, 
            message: 'user_id가 필요합니다.' 
        });
    }

    // 2. 해당 유저의 모든 경로 조회 (최신순 정렬)
    const sql = `
        SELECT * FROM saved_route 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    `;

    // 3. DB 실행
    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error('경로 조회 중 에러 발생:', err);
            return res.status(500).json({ 
                success: false, 
                message: '데이터베이스 오류가 발생했습니다.' 
            });
        }

        // 4. 조회 결과 반환
        res.status(200).json({ 
            success: true, 
            message: '저장된 경로 목록을 불러왔습니다.',
            data: results // 조회된 경로 배열 (없으면 빈 배열 [])
        });
    });
});

module.exports = router;