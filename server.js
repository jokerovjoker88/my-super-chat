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

const tempUsers = {}; 

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, email TEXT, password TEXT, is_online BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, 
                file_data TEXT, file_name TEXT, is_read BOOLEAN DEFAULT FALSE, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA SERVER ONLINE ===");
    } catch (e) { console.error("DATABASE ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    // Регистрация
    socket.on('register', async (data) => {
        const { nick, email, pass } = data;
        const passRegex = /^[A-Za-z\d]{6,}$/;
        
        if (!passRegex.test(pass)) {
            return socket.emit('auth_error', 'Пароль: мин. 6 символов (буквы и цифры)');
        }

        try {
            const check = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [nick, email]);
            if (check.rows.length > 0) return socket.emit('auth_error', 'Ник или Email заняты');

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const hashed = await bcrypt.hash(pass, 10);
            tempUsers[email] = { nick, email, hashed, code };

            const mailOptions = {
                from: '"Nebula Support" <ТВОЙ_EMAIL@gmail.com>',
                to: email,
                subject: 'Код подтверждения Nebula',
                text: `Ваш код: ${code}`
            };

            transporter.sendMail(mailOptions, (err) => {
                if (err) return socket.emit('auth_error', 'Ошибка отправки почты');
                socket.emit('code_sent', email);
            });
        } catch (e) { socket.emit('auth_error', 'Ошибка сервера'); }
    });

    // Код подтверждения
    socket.on('verify_code', async ({ email, code }) => {
        const user = tempUsers[email];
        if (user && user.code === code) {
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", 
                [user.nick, user.email, user.hashed]);
            delete tempUsers[email];
            socket.emit('auth_success', 'Регистрация завершена! Войдите.');
        } else {
            socket.emit('auth_error', 'Неверный код!');
        }
    });

    // Вход
    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(pass, user.password)) {
            socket.username = nick;
            socket.emit('auth_ok', { nick });
        } else {
            socket.emit('auth_error', 'Неверный логин или пароль');
        }
    });
});

server.listen(process.env.PORT || 10000);
