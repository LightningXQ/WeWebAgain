const express = require('express');
const authRepo = require('../repository/authRepo');
const router = express.Router();

router.get('/idcheck/:id',async (req, res)=>{
    const id = req.params.id;

    const userInfo = await authRepo.getUserById(id);
    try {
        if(userInfo.id){
            return res.send(false).json({message:'중복ID'})
        }
        else{
            res.send(true)
        }   
    }   catch (error) {
        res.send(true)
    }
    
})

module.exports = router;
