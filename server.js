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
        await db.query("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png')");
        await db.query("CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        console.log("DB ONLINE");
    } catch (e) { console.error(e); }
}
boot();

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

io.on('connection', (socket) => {
    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const u = res.rows[0];
        if (u && await bcrypt.compare(d.pass, u.password)) {
            socket.username = u.username;
            socket.join(u.username);
            socket.emit('auth_ok', { nick: u.username });
        }
    });

    socket.on('load_chat', async (d) => {
        const sql = "SELECT sender as from, content, to_char(ts, 'HH24:MI') as time FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1) ORDER BY ts ASC";
        const res = await db.query(sql, [d.me, d.him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (d) => {
        const sql = "INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3) RETURNING to_char(ts, 'HH24:MI') as time";
        const res = await db.query(sql, [d.from, d.to, d.content]);
        io.to(d.to).to(d.from).emit('new_msg', { ...d, time: res.rows[0].time });
    });
});

server.listen(process.env.PORT || 10000);
