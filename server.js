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
        const res = await db.query("SELECT *
