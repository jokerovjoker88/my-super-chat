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

const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
db.connect();

// Настройка почты (Вставь свои данные или используй ENV переменные)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'твой_email@gmail.com', 
        pass: 'твой_пароль_приложения' 
    }
});

const tempUsers = {}; // Временное хранилище для ожидающих подтверждения

io.on('connection', (socket) => {
    
    socket.on('register', async ({ nick, email, pass }) => {
        // 1. Проверка сложности пароля (минимум 8 знаков, буквы + цифры + символы)
        const passRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passRegex.test(pass)) {
            return socket.emit('auth_error', 'Пароль слишком простой! Нужно: 8+ знаков, буквы, цифры и спецсимвол (@$!%*#?&)');
        }

        const check = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [nick, email]);
        if (check.rows.length > 0) return socket.emit('auth_error', 'Ник или Email уже заняты');

        // 2. Генерация кода и сохранение во временную память
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashed = await bcrypt.hash(pass, 10);
        
        tempUsers[email] = { nick, email, hashed, code };

        // 3. Отправка письма
        const mailOptions = {
            from: 'Nebula Chat',
            to: email,
            subject: 'Код подтверждения Nebula',
            text: `Ваш код подтверждения: ${code}`
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) return socket.emit('auth_error', 'Ошибка отправки письма');
            socket.emit('code_sent', email);
        });
    });

    socket.on('verify_code', async ({ email, code }) => {
        const user = tempUsers[email];
        if (user && user.code === code) {
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", 
                [user.nick, user.email, user.hashed]);
            delete tempUsers[email];
            socket.emit('auth_success', 'Почта подтверждена! Войдите.');
        } else {
            socket.emit('auth_error', 'Неверный код!');
        }
    });

    // ... остальной код входа и сообщений остается прежним
});

server.listen(process.env.PORT || 10000);
