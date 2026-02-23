const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

app.use(express.static('public'));

const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function init() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
            CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, type TEXT DEFAULT 'text', ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("NEBULA DB CONNECTED");
    } catch (e) { console.error(e); }
}
init();

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const h = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [d.nick, d.email, h]);
            socket.emit('auth_success');
        } catch (e) { socket.emit('auth_error', 'Ник или почта заняты'); }
    });

    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const u = res.rows[0];
        if (u && await bcrypt.compare(d.pass, u.password)) {
            socket.username = u.username; socket.join(u.username);
            socket.emit('auth_ok', { nick: u.username, avatar: u.avatar });
        } else { socket.emit('auth_error', 'Неверный логин'); }
    });

    socket.on('update_avatar', async (url) => {
        if (!socket.username) return;
        await db.query("UPDATE users SET avatar = $1 WHERE username = $2", [url, socket.username]);
        socket.emit('avatar_updated', url);
    });

    socket.on('search_user', async (name) => {
        const res = await db.query("SELECT username, avatar FROM users WHERE username = $1", [name]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    socket.on('load_chat', async (d) => {
        const res = await db.query("SELECT sender, content, type, to_char(ts, 'HH24:MI') as time FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1) ORDER BY ts ASC", [d.me, d.him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (d) => {
        const res = await db.query("INSERT INTO messages (sender, receiver, content, type) VALUES ($1, $2, $3, $4) RETURNING to_char(ts, 'HH24:MI') as time", [d.from, d.to, d.content, d.type]);
        io.to(d.to).to(d.from).emit('new_msg', { ...d, time: res.rows[0].time });
    });
});

server.listen(process.env.PORT || 10000);
