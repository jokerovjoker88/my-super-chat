const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const db = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
            CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("SERVER ONLINE");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const u = res.rows[0];
        if (u && await bcrypt.compare(d.pass, u.password)) {
            socket.username = u.username;
            socket.join(u.username);
            socket.emit('auth_ok', { nick: u.username });
        } else {
            socket.emit('auth_err', 'Ошибка входа');
        }
    });

    socket.on('load_chat', async (d) => {
        const res = await db.query(
            "SELECT
