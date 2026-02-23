const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path'); // Добавь это!

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Настройка для работы с папкой public
app.use(express.static(path.join(__dirname, 'public')));

// Если кто-то заходит на главную, принудительно отдаем index.html из папки public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const db = new Client({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
            CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, type TEXT DEFAULT 'text', ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("DB ONLINE");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const h = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users VALUES ($1, $2, $3)", [d.nick, d.email, h]);
            socket.emit('auth_success');
        } catch (e) { socket.emit('auth_error'); }
    });
    socket.on('login', async (d) => {
        const r = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const u = r.rows[0];
        if (u && await bcrypt.compare(d.pass, u.password)) {
            socket.username = u.username; socket.join(u.username);
            socket.emit('auth_ok', { nick: u.username, avatar: u.avatar });
        } else { socket.emit('auth_error'); }
    });
    socket.on('update_avatar', async (url) => {
        if (socket.
