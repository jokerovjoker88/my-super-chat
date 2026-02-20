const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function boot() {
    try {
        await db.connect();
        // Создаем таблицы с поддержкой аватарок и статуса прочитано
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                avatar TEXT, 
                is_online BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(username),
                receiver TEXT REFERENCES users(username),
                content TEXT,
                file_data TEXT,
                file_name TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA ULTIMATE READY ===");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('auth', async (nick) => {
        if (!nick) return;
        await db.query("INSERT INTO users (username, is_online) VALUES ($1, TRUE) ON CONFLICT (username) DO UPDATE SET is_online = TRUE", [nick]);
        socket.username = nick;
        socket.join(nick);
        
        const user = await db.query("SELECT avatar FROM users WHERE username = $1", [nick]);
        socket.emit('auth_ok', { avatar: user.rows[0]?.avatar });
        io.emit('status_update', { user: nick, online: true });
    });

    socket.on('update_avatar', async (img) => {
        await db.query("UPDATE users SET avatar = $1 WHERE username = $2", [img, socket.username]);
        io.emit('avatar_changed', { user: socket.username, avatar: img });
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT ON (partner) 
                partner, u.is_online, u.avatar,
