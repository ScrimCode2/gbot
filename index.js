require('dotenv').config();
const { connectDB } = require('./db');
const { start } = require('./bot');

connectDB().then(() => {
    start();
}).catch(err => console.log(err));
