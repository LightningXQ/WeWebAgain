const express = require('express');
const authRepo = require('../repository/authRepo');
const router = express.Router();

router.get('/idcheck/:id',async (req, res)=>{
    const id = req.params.id;

    const userInfo = await authRepo.getUserById(id);
    try {
        if(userInfo.id){
            return res.json({check:false})
        }
        else{
            res.json({check:true})
        }   
    }   catch (error) {
            res.json({check:true})
    }
    
})

module.exports = router;
