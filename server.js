const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function boot() {
    try {
        await db.connect();
        // Создаем таблицы с правильной логикой связей
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS chats (chat_id TEXT PRIMARY KEY, type TEXT DEFAULT 'private');
            CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT, username TEXT, PRIMARY KEY(chat_id, username));
            CREATE TABLE IF NOT EXISTS messages (id SERIAL, chat_id TEXT, sender TEXT, text TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        console.log("=== NEBULA SYSTEM ONLINE ===");
    } catch (e) { console.error("CRITICAL DB ERROR", e); }
}
boot();

io.on('connection', (socket) => {
    // 1. Авторизация и регистрация
    socket.on('login', async (nick) => {
        try {
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [nick]);
            socket.username = nick;
            socket.join(nick); // Личная комната для уведомлений
            console.log(`User ${nick} authorized`);
            socket.emit('login_success');
        } catch (e) { console.log(e); }
    });

    // 2. Получение списка диалогов
    socket.on('fetch_chats', async (nick) => {
        const res = await db.query(`
            SELECT m2.chat_id, m2.username as partner
            FROM chat_members m1
            JOIN chat_members m2 ON m1.chat_id = m2.chat_id
            WHERE m1.username = $1 AND m2.username != $1
        `, [nick]);
        socket.emit('update_chats', res.rows);
    });

    // 3. Создание нового чата (Поиск ника)
    socket.on('create_chat', async ({ me, partner }) => {
        try {
            const chatId = [me, partner].sort().join('_');
            await db.query("INSERT INTO chats (chat_id) VALUES ($1) ON CONFLICT DO NOTHING", [chatId]);
            await db.query("INSERT INTO chat_members (chat_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, me]);
            await db.query("INSERT INTO chat_members (chat_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, partner]);
            
            // Уведомляем обоих участников
            io.to(me).to(partner).emit('chat_created', chatId);
        } catch (e) { console.log(e); }
    });

    // 4. Вход в конкретный чат
    socket.on('open_chat', async (chatId) => {
        socket.join(chatId);
        const res = await db.query("SELECT sender, text FROM messages WHERE chat_id = $1 ORDER BY ts ASC", [chatId]);
        socket.emit('load_history', res.rows);
    });

    // 5. Отправка сообщения
    socket.on('send_message', async (data) => {
        try {
            await db.query("INSERT INTO messages (chat_id, sender, text) VALUES ($1, $2, $3)", [data.chatId, data.sender, data.text]);
            io.to(data.chatId).emit('new_message', data);
        } catch (e) { console.log(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
