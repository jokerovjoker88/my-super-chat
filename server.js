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
        user: 'ВАШ_EMAIL@gmail.com', 
        pass: 'ВАШ_ПАРОЛЬ_ПРИЛОЖЕНИЯ' 
    }
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, email TEXT, password TEXT
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA READY: INSTANT REG ===");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    // МГНОВЕННАЯ РЕГИСТРАЦИЯ
    socket.on('register', async ({ nick, email, pass }) => {
        // Простой пароль: буквы и цифры, от 6 знаков
        const passRegex = /^[A-Za-z\d]{6,}$/;
        if (!passRegex.test(pass)) {
            return socket.emit('auth_error', 'Пароль: мин. 6 символов (только латиница и цифры)');
        }

        try {
            const check = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [nick, email]);
            if (check.rows.length > 0) return socket.emit('auth_error', 'Ник или Email уже заняты');

            const hashed = await bcrypt.hash(pass, 10);
            
            // Сохраняем в базу сразу
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [nick, email, hashed]);

            // Отправляем уведомление на почту (в фоне, не заставляя ждать)
            transporter.sendMail({
                from: '"Nebula Support" <your-email@gmail.com>',
                to: email,
                subject: 'Успешная регистрация в Nebula',
                html: `<h1>Привет, ${nick}!</h1><p>Твой аккаунт успешно создан. Добро пожаловать!</p>`
            }).catch(e => console.log("Mail background error:", e.message));

            // Сразу разрешаем вход
            socket.emit('auth_success', 'Регистрация прошла успешно! Войдите в аккаунт.');
            
        } catch (e) {
            socket.emit('auth_error', 'Ошибка сервера при регистрации');
        }
    });

    // ВХОД
    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(pass, user.password)) {
            socket.emit('auth_ok', { nick });
        } else {
            socket.emit('auth_error', 'Неверный логин или пароль');
        }
    });
});

server.listen(process.env.PORT || 10000);
