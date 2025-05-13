const express = require('express');
const authRepo = require('../repository/authRepo');
const router = express.Router();

router.get('/idcheck/:id',async (req, res)=>{
    const id = req.params.id;

    const userInfo = await authRepo.getUserById(id);
    try {
        if(userInfo.id){
            return res.send('중복 ID')
        }
        else{
            res.send(`${id} 사용가능`)
        }
    } catch (error) {
        res.send('사용불가능 Id')
    }
    
})

module.exports = router;
