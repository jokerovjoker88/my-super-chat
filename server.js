const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // Разрешаем файлы до 100мб
});

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function boot() {
    try {
        await db.connect();
        // Создаем таблицы (аккаунты теперь не удалятся при обновлении)
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                email TEXT UNIQUE, 
                password TEXT, 
                avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            )`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, 
                sender TEXT, 
                receiver TEXT, 
                content TEXT, 
                type TEXT DEFAULT 'text', 
                is_read BOOLEAN DEFAULT FALSE, 
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
        console.log("=== NEBULA CORE V3 ONLINE ===");
    } catch (e) { console.error("DB ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const hashed = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [d.nick, d.email, hashed]);
            socket.emit('auth_success', 'Аккаунт создан!');
        } catch (e) { socket.emit('auth_error', 'Ник или почта заняты'); }
    });

    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(d.pass, user.password)) {
            socket.username = user.username;
            socket.join(user.username);
            socket.emit('auth_ok', { nick: user.username, avatar: user.avatar });
        } else { socket.emit('auth_error', 'Неверный логин или пароль'); }
    });

    socket.on('search_user', async (name) => {
        const res = await db.query("SELECT username, avatar FROM users WHERE username = $1", [name]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    socket.on('load_chat', async (d) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [d.him, d.me]);
        const res = await db.query(`
            SELECT sender, content, type, is_read, to_char(ts, 'HH24:MI') as time 
            FROM messages WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) 
            ORDER BY ts ASC`, [d.me, d.him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (d) => {
        const res = await db.query(
            "INSERT INTO messages (sender, receiver, content, type) VALUES ($1, $2, $3, $4) RETURNING to_char(ts, 'HH24:MI') as time",
            [d.from, d.to, d.text, d.type || 'text']
        );
        const time = res.rows[0].time;
        const payload = { ...d, time, is_read: false };
        io.to(d.to).to(d.from).emit('new_msg', payload);
    });
});

server.listen(process.env.PORT || 10000);
