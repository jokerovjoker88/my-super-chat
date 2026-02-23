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
        pass: 'ВАШ_ПАРОЛЬ_ПРИЛОЖЕНИЯ' // 16 букв без пробелов
    }
});

const tempUsers = {}; 

async function boot() {
    try {
        await db.connect();
        console.log("DB CONNECTED");
    } catch (e) { console.error("DB ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    console.log("User connected:", socket.id);

    socket.on('register', async (data) => {
        console.log("Register attempt for:", data.email);
        
        try {
            const { nick, email, pass } = data;
            const passRegex = /^[A-Za-z\d]{6,}$/;
            if (!passRegex.test(pass)) {
                return socket.emit('auth_error', 'Пароль: мин. 6 символов (только латынь и цифры)');
            }

            const check = await db.query("SELECT * FROM users WHERE username = $1 OR email = $2", [nick, email]);
            if (check.rows.length > 0) return socket.emit('auth_error', 'Ник или почта заняты');

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const hashed = await bcrypt.hash(pass, 10);
            
            tempUsers[email] = { nick, email, hashed, code };

            const mailOptions = {
                from: '"Nebula Chat" <ВАШ_EMAIL@gmail.com>',
                to: email,
                subject: 'Код Nebula',
                text: `Ваш код: ${code}`
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error("MAIL ERROR:", err);
                    return socket.emit('auth_error', 'Ошибка почты: ' + err.message);
                }
                console.log("Email sent to:", email);
                socket.emit('code_sent');
            });

        } catch (e) {
            console.error("REG ERROR:", e);
            socket.emit('auth_error', 'Системная ошибка');
        }
    });

    socket.on('verify_code', async ({ email, code }) => {
        const user = tempUsers[email];
        if (user && user.code === code) {
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", 
                [user.nick, user.email, user.hashed]);
            delete tempUsers[email];
            socket.emit('auth_success', 'Успешно! Войдите.');
        } else {
            socket.emit('auth_error', 'Неверный код');
        }
    });

    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(pass, user.password)) {
            socket.username = nick;
            socket.join(nick);
            socket.emit('auth_ok', { nick });
        } else {
            socket.emit('auth_error', 'Ошибка входа');
        }
    });
});

server.listen(process.env.PORT || 10000);
