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

// Инициализация БД
async function initDB() {
    try {
        await db.connect();
        // Таблица для хранения сообщений
        await db.query(`CREATE TABLE IF NOT EXISTS msgs (
            id SERIAL PRIMARY KEY, 
            sender TEXT, 
            txt TEXT, 
            room TEXT, 
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        // Таблица прав доступа к комнатам
        await db.query(`CREATE TABLE IF NOT EXISTS room_users (
            room_id TEXT, 
            user_nick TEXT, 
            PRIMARY KEY (room_id, user_nick)
        )`);
        console.log("DB Ready");
    } catch (e) { console.error("DB Init Error:", e); }
}
initDB();

io.on('connection', (socket) => {
    // Получение списка чатов пользователя
    socket.on('get_rooms', async (nick) => {
        try {
            const res = await db.query("SELECT room_id FROM room_users WHERE user_nick = $1", [nick]);
            socket.emit('list_rooms', res.rows.map(r => r.room_id));
        } catch (e) { console.error(e); }
    });

    // Создание чата
    socket.on('create_room', async ({ room, nick }) => {
        try {
            await db.query("INSERT INTO room_users (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, nick]);
            socket.emit('update_ui');
        } catch (e) { console.error(e); }
    });

    // Добавление друга по нику
    socket.on('add_friend', async ({ room, friend }) => {
        try {
            await db.query("INSERT INTO room_users (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, friend]);
            io.emit('refresh_for', friend); // Сигнал конкретному юзеру обновить список
        } catch (e) { console.error(e); }
    });

    // Вход в чат и загрузка истории
    socket.on('join_chat', async ({ room }) => {
        socket.join(room);
        try {
            const res = await db.query("SELECT * FROM msgs WHERE room = $1 ORDER BY ts ASC", [room]);
            socket.emit('history', res.rows);
        } catch (e) { console.error(e); }
    });

    // Отправка сообщения
    socket.on('msg', async (data) => {
        try {
            await db.query("INSERT INTO msgs (sender, txt, room) VALUES ($1, $2, $3)", [data.nick, data.txt, data.room]);
            io.to(data.room).emit('new_msg', data);
        } catch (e) { console.error(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
