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
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
            CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, type TEXT DEFAULT 'text', is_read BOOLEAN DEFAULT false, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("=== DATABASE CONNECTED AND READY ===");
    } catch (e) { console.error("DB Error:", e); }
}
boot();

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

io.on('connection', (socket) => {
    socket.on('login', async (d) => {
        try {
            const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
            const u = res.rows[0];
            if (u && await bcrypt.compare(d.pass, u.password)) {
                socket.username = u.username;
                socket.join(u.username);
                socket.emit('auth_ok', { nick: u.username, avatar: u.avatar });
            } else {
                socket.emit('auth_error', 'Неверный логин или пароль');
            }
        } catch (e) { console.error(e); }
    });

    socket.on('load_chat', async (d) => {
        try {
            const res = await db.query("SELECT sender as from, content, type, to_char(ts, 'HH24:MI') as time, is_read FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1) ORDER BY ts ASC", [d.me, d.him]);
            socket.emit('chat_history', res.rows);
        } catch (e) { console.error(
