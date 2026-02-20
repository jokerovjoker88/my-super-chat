const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" }, 
    maxHttpBufferSize: 1e7 // Разрешаем файлы до 10МБ
});

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initSystem() {
    try {
        await db.connect();
        // Создаем таблицы, если их нет
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(username),
                receiver TEXT REFERENCES users(username),
                content TEXT,
                file_data TEXT,
                file_name TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA CORE v3: ONLINE ===");
    } catch (e) { console.error("DB Init Error:", e); }
}
initSystem();

io.on('connection', (socket) => {
    // Вход / Регистрация
    socket.on('auth', async (nick) => {
        if (!nick) return;
        try {
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET last_seen = NOW()", [nick]);
            socket.username = nick;
            socket.join(nick);
            socket.emit('auth_ok');
        } catch (e) { console.error(e); }
    });

    // Поиск любого ника (Бесконечные пользователи)
    socket.on('search_user', async (target) => {
        if (!target) return;
        try {
            // Если пользователя нет, создаем его "заочно"
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [target]);
            socket.emit('user_found', target);
        } catch (e) { console.error(e); }
    });

    // Загрузка списка чатов
    socket.on('get_my_dialogs', async (me) => {
        try {
            const res = await db.query(`
                SELECT DISTINCT CASE WHEN sender = $1 THEN receiver ELSE sender END as partner
                FROM messages WHERE sender = $1 OR receiver = $1
            `, [me]);
            socket.emit('dialogs_list', res.rows);
        } catch (e) { console.error(e); }
    });

    // Загрузка истории
    socket.on('load_chat', async ({ me, him }) => {
        try {
            const res = await db.query(`
                SELECT sender, content, file_data, file_name, ts FROM messages 
                WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
                ORDER BY ts ASC
            `, [me, him]);
            socket.emit('chat_history', res.rows);
        } catch (e) { console.error(e); }
    });

    // Отправка сообщения
    socket.on('send_msg', async (data) => {
        try {
            // Гарантируем наличие отправителя и получателя в базе
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [data.from]);
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [data.to]);

            await db.query(
                "INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5)",
                [data.from, data.to, data.text, data.file || null, data.fileName || null]
            );
            
            // Рассылаем участникам
            io.to(data.from).to(data.to).emit('new_msg', data);
        } catch (e) { console.error("Message error:", e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
