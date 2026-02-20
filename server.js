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

async function init() {
    try {
        await db.connect();
        // Таблица пользователей
        await db.query(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY)`);
        // Таблица чатов (у каждого чата есть ID)
        await db.query(`CREATE TABLE IF NOT EXISTS chats (chat_id TEXT PRIMARY KEY)`);
        // Кто в каком чате
        await db.query(`CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT, username TEXT, PRIMARY KEY(chat_id, username))`);
        // Сообщения
        await db.query(`CREATE TABLE IF NOT EXISTS messages (chat_id TEXT, sender TEXT, text TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        console.log("Database Ready");
    } catch (e) { console.error(e); }
}
init();

io.on('connection', (socket) => {
    // Регистрация ника при входе
    socket.on('auth', async (nick) => {
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [nick]);
        socket.emit('auth_ok');
    });

    // Поиск чатов пользователя
    socket.on('get_my_chats', async (nick) => {
        const res = await db.query(`
            SELECT cm2.chat_id, cm2.username as partner 
            FROM chat_members cm1
            JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
            WHERE cm1.username = $1 AND cm2.username != $1
        `, [nick]);
        socket.emit('chats_list', res.rows);
    });

    // Найти пользователя и начать чат
    socket.on('start_chat', async ({ me, partner }) => {
        const chatId = [me, partner].sort().join('_'); // Уникальный ID для пары
        await db.query("INSERT INTO chats (chat_id) VALUES ($1) ON CONFLICT DO NOTHING", [chatId]);
        await db.query("INSERT INTO chat_members (chat_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, me]);
        await db.query("INSERT INTO chat_members (chat_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, partner]);
        
        socket.emit('chat_ready', chatId);
    });

    socket.on('join_chat', async (chatId) => {
        socket.join(chatId);
        const res = await db.query("SELECT sender, text FROM messages WHERE chat_id = $1 ORDER BY ts ASC", [chatId]);
        socket.emit('history', res.rows);
    });

    socket.on('msg', async (data) => {
        await db.query("INSERT INTO messages (chat_id, sender, text) VALUES ($1, $2, $3)", [data.chatId, data.sender, data.text]);
        io.to(data.chatId).emit('new_msg', data);
    });
});

server.listen(process.env.PORT || 10000);
