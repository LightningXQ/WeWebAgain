const db = require('../db');

module.exports={
    signup : (id, password, name, email) =>{
        return new Promise((resolve, reject)=>{
            db.query("INSERT INTO `webagain`.`user` (`id`, `email`, `username`, `password`) VALUES (?,?,?,?);",[id, email, name, password],(err, result)=>{
                if(err){return reject(err)}
                resolve(result)
            })
        })
    },
    getUserById : (userId) =>{
        return new Promise((resolve, reject)=>{
            db.query('SELECT * FROM user', (err, results) => {
                if(err){return reject(err)}
                resolve(result)
            })
        })
    }}