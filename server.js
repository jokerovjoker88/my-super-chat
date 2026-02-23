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

// НАСТРОЙКА ПОЧТЫ
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ТВОЙ_EMAIL@gmail.com', 
        pass: 'ПАРОЛЬ_ПРИЛОЖЕНИЯ' 
    }
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT, password TEXT);
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, 
                is_read BOOLEAN DEFAULT FALSE, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA SERVER ONLINE ===");
    } catch (e) { console.error("DB ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    // Регистрация
    socket.on('register', async ({ nick, email, pass }) => {
        try {
            const hashed = await bcrypt.hash(pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [nick, email, hashed]);
            
            // Письмо уходит в фоне
            transporter.sendMail({
                from: '"Nebula Chat"',
                to: email,
                subject: 'Добро пожаловать!',
                text: `Привет, ${nick}! Ты успешно зарегистрирован в Nebula.`
            }).catch(e => console.log("Mail background error"));

            socket.emit('auth_success', 'Регистрация успешна! Войдите.');
        } catch (e) { socket.emit('auth_error', 'Ник или Email уже заняты'); }
    });

    // Вход
    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(pass, user.password)) {
            socket.username = nick;
            socket.join(nick);
            socket.emit('auth_ok', { nick });
        } else {
            socket.emit('auth_error', 'Неверные данные');
        }
    });

    // Поиск
    socket.on('search_user', async (name) => {
        const res = await db.query("SELECT username FROM users WHERE username = $1", [name]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    // История и отметка "Прочитано"
    socket.on('load_chat', async ({ me, him }) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [him, me]);
        const res = await db.query(`SELECT sender, content, is_read, to_char(ts, 'HH24:MI') as time FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) ORDER BY ts ASC`, [me, him]);
        socket.emit('chat_history', res.rows);
    });

    // Отправка сообщения
    socket.on('send_msg', async (d) => {
        const res = await db.query("INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3) RETURNING to_char(ts, 'HH24:MI') as time", [d.from, d.to, d.text]);
        const time = res.rows[0].time;
        io.to(d.to).to(d.from).emit('new_msg', { ...d, time, is_read: false });
    });
});

server.listen(process.env.PORT || 10000);
