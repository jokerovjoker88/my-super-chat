const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ТВОЙ_EMAIL@gmail.com',
        pass: 'ВАШ_16_ЗНАЧНЫЙ_КОД'
    }
});

async function boot() {
    try {
        await db.connect();
        // Добавлено поле avatar_url
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY, 
            email TEXT, 
            password TEXT, 
            avatar_url TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY, 
            sender TEXT, 
            receiver TEXT, 
            content TEXT, 
            is_read BOOLEAN DEFAULT FALSE, 
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log("=== NEBULA V2 ONLINE ===");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const hashed = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [d.nick, d.email, hashed]);
            transporter.sendMail({ from: '"Nebula"', to: d.email, subject: 'Welcome!', text: 'Вы зарегистрированы!' }).catch(() => {});
            socket.emit('auth_success', 'Успех!');
        } catch (e) { socket.emit('auth_error', 'Ошибка регистрации'); }
    });

    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(d.pass, user.password)) {
            socket.username = d.nick;
            socket.join(d.nick);
            socket.emit('auth_ok', { nick: user.username, avatar: user.avatar_url });
        } else { socket.emit('auth_error', 'Ошибка входа'); }
    });

    socket.on('search_user', async (name) => {
        const res = await db.query("SELECT username, avatar_url FROM users WHERE username = $1", [name]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    socket.on('load_chat', async (d) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [d.him, d.me]);
        const res = await db.query(`SELECT sender, content, is_read, to_char(ts, 'HH24:MI') as time 
            FROM messages WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) ORDER BY ts ASC`, [d.me, d.him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (d) => {
        const res = await db.query("INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3) RETURNING to_char(ts, 'HH24:MI') as time", [d.from, d.to, d.text]);
        io.to(d.to).to(d.from).emit('new_msg', { ...d, time: res.rows[0].time, is_read: false });
    });
});

server.listen(process.env.PORT || 10000);
