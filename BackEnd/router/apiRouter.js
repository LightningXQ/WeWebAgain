const express = require('express');
const authRepo = require('../repository/authRepo');
const router = express.Router();

router.get('/idcheck/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const userInfo = await authRepo.getUserById(id);

        if (userInfo.length > 0) {
            return res.json({ check: false });
        } else {
            return res.json({ check: true });
        }
    } catch (error) {
        console.error('ID 중복 확인 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
