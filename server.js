const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // Поддержка файлов до 100мб
});

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                email TEXT UNIQUE, 
                password TEXT, 
                avatar TEXT DEFAULT 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, 
                sender TEXT, 
                receiver TEXT, 
                content TEXT, 
                type TEXT DEFAULT 'text', 
                is_read BOOLEAN DEFAULT FALSE, 
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA V5: СИСТЕМА ГОТОВА ===");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('register', async (d) => {
        try {
            const hashed = await bcrypt.hash(d.pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [d.nick, d.email, hashed]);
            socket.emit('auth_success', 'Аккаунт создан!');
        } catch (e) { socket.emit('auth_error', 'Ник или почта уже заняты'); }
    });

    socket.on('login', async (d) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [d.nick]);
        const user = res.rows[0];
        if (user && await bcrypt.compare(d.pass, user.password)) {
            socket.username = user.username;
            socket.join(user.username);
            socket.emit('auth_ok', { nick: user.username, avatar: user.avatar });
        } else
