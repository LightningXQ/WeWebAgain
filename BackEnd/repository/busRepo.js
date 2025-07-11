// C:\github\webagain\BackEnd\repository\authRepo.js
const db = require('../db');

module.exports = {
    getBusRoute : (busNo, stopId, stopOrder)=>{
        return new Promise((resolve, reject) => {
            db.query(`insert into buses ?,?,?`,[busNo],[stopId],[stopOrder],(err, result)=>{
                if(err){
                    reject(err)
                }
                resolve(result)
            })
        })
    },
    insertBusRoute :(busNo)=>{

    },
    
}