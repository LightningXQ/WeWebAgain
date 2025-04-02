const express = require('express')
const app = express()
var bodyParser = require('body-parser')
var fs = require('fs');
const compression = require('compression');
var mysql = require('mysql')




const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'webagain',
});

db.connect();



app.get('/insert',function(request, response, next){
  db.query(`insert into user values('1','rhqlthf1@pukyong.ac.kr', '고비솔', 'rhqlthf', now(), now(), null); `, function(err, result){
    if(err){throw err}
    response.send(`id=${result[0].username} pw=${result[0].password}`)
    console.log(result);
  })
})

app.get('/',function(request, response, next){
  db.query('select * from user;', function(err, result){
    if(err){throw err}
    response.send(`id=${result[0].username} pw=${result[0].password}`)
    console.log(result);
  })
})

app.listen(3000, ()=> console.log('listening 3000'))

