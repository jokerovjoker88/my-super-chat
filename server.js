const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Обслуживание статических файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

const db = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                email TEXT UNIQUE, 
                password TEXT, 
                avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, 
                sender TEXT, 
                receiver TEXT, 
                content TEXT, 
                type TEXT DEFAULT 'text', 
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA SERVER ONLINE ===");
    } catch (e) { console.error("DB Error:", e); }
}
boot();

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const h = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [d.nick, d.email, h]);
            socket.emit('auth_success');
        } catch (e) { socket.emit('auth_error', 'Ошибка регистрации'); }
    });

    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const u = res.rows[0];
        if (u && await bcrypt.compare(d.pass, u.password)) {
            socket.username = u.username;
            socket.join(u.username);
            socket.emit('auth_ok', { nick: u.username, avatar: u.avatar });
        } else { socket.emit('auth_error', 'Неверный логин'); }
    });

    socket.on('update_avatar', async (url) => {
        if (socket.username) {
            await db.query("UPDATE users SET avatar = $1 WHERE username = $2", [url, socket.username]);
            socket.emit('avatar_updated', url);
        }
    });

    socket.on('search_user', async (n) => {
        const res = await db.query("SELECT username, avatar FROM users WHERE username = $1", [n]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    socket.on('load_chat', async (d) => {
        const res = await db.query(
            "SELECT sender as from, content, type, to_char(ts, 'HH24:MI') as time FROM
