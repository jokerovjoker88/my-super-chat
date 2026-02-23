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

// Настройка почты
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'jokerovjoker88@gmail.com', 
        pass: '123789654Jj' 
    }
});

const tempUsers = {}; 

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT, password TEXT);
            CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("SERVER STARTED");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    // 1. Запрос на регистрацию
    socket.on('register', async (data) => {
        const { nick, email, pass } = data;
        // Проверка пароля: буквы и цифры, мин 6 символов
        const passRegex = /^[A-Za-z\d]{6,}$/;
        if (!passRegex.test(pass)) return socket.emit('auth_error', 'Пароль: мин. 6 символов (буквы и цифры)');

        try {
            const check = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [nick, email]);
            if (check.rows.length > 0) return socket.emit('auth_error', 'Ник или Email заняты');

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const hashed = await bcrypt.hash(pass, 10);
            tempUsers[email] = { nick, email, hashed, code };

            transporter.sendMail({
                from: '"Nebula" <your-email@gmail.com>',
                to: email,
                subject: 'Код Nebula',
                text: `Ваш код: ${code}`
            }, (err) => {
                if (err) return socket.emit('auth_error', 'Ошибка почты');
                socket.emit('code_sent');
            });
        } catch (e) { socket.emit('auth_error', 'Ошибка БД'); }
    });

    // 2. Проверка кода
    socket.on('verify_code', async ({ email, code }) => {
        const user = tempUsers[email];
        if (user && user.code === code) {
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [user.nick, user.email, user.hashed]);
            delete tempUsers[email];
            socket.emit('auth_success');
        } else {
            socket.emit('auth_error', 'Неверный код');
        }
    });

    // 3. Вход
    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(pass, user.password)) {
            socket.emit('auth_ok', { nick });
        } else {
            socket.emit('auth_error', 'Неверный вход');
        }
    });
});

server.listen(process.env.PORT || 10000);
