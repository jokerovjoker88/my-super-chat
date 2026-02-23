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

// НАСТРОЙКА ПОЧТЫ (Впиши свои данные здесь)
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
        await db.query("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT, password TEXT)");
        await db.query("CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, is_read BOOLEAN DEFAULT FALSE, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        console.log("=== SERVER ONLINE ===");
    } catch (e) { 
        console.error("DB BOOT ERROR:", e); 
    }
}
boot();

io.on('connection', (socket) => {
    // Регистрация
    socket.on('register', async (data) => {
        try {
            const hashed = await bcrypt.hash(data.pass, 10);
            const sql = "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)";
            await db.query(sql, [data.nick, data.email, hashed]);
            
            transporter.sendMail({
                from: '"Nebula Chat"',
                to: data.email,
                subject: 'Добро пожаловать!',
                text: `Привет, ${data.nick}! Регистрация прошла успешно.`
            }).catch(e => console.log("Mail background error"));

            socket.emit('auth_success', 'Регистрация успешна!');
        } catch (e) { 
            socket.emit('auth_error', 'Ник или Email уже заняты'); 
        }
    });

    // Вход
    socket.on('login', async (data) => {
        try {
            const res = await db.query("SELECT * FROM users WHERE username = $1", [data.nick]);
            const user = res.rows[0];
            if (user && await bcrypt.compare(data.pass, user.password)) {
                socket.username = data.nick;
                socket.join(data.nick);
                socket.emit('auth_ok', { nick: data.nick });
            } else {
                socket.emit('auth_error', 'Неверный логин или пароль');
            }
        } catch (e) {
            socket.emit('auth_error', 'Ошибка сервера при входе');
        }
    });

    // Поиск
    socket.on('search_user', async (name) => {
        try {
            const res = await db.query("SELECT username FROM users WHERE username = $1", [name]);
            if (res.rows[0]) socket.emit('user_found', res.rows[0]);
            else socket.emit('auth_error', 'Пользователь не найден');
        } catch (e) {
            socket.emit('auth_error', 'Ошибка поиска');
        }
    });

    // Загрузка чата
    socket.on('load_chat', async (data) => {
        try {
            await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [data.him, data.me]);
            const sql = "SELECT sender, content, is_read, to_char(ts, 'HH24:MI') as time FROM messages WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) ORDER BY ts ASC";
            const res = await db.query(sql, [data.me, data.him]);
            socket.emit('chat_history', res.rows);
        } catch (e) {
            console.error(e);
        }
    });

    // Сообщение
    socket.on('send_msg', async (d) => {
        try {
            const sql = "INSERT INTO messages (sender, receiver, content) VALUES ($1, $2, $3) RETURNING to_char(ts, 'HH24:MI') as time";
            const res = await db.query(sql, [d.from, d.to, d.text]);
            const time = res.rows[0].time;
            io.to(d.to).to(d.from).emit('new_msg', { ...d, time, is_read: false });
        } catch (e) {
            console.error(e);
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
