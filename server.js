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
        // Полная пересборка таблиц без жестких связей
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_log (
                id SERIAL PRIMARY KEY,
                room TEXT,
                sender TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS access_list (
                nick TEXT,
                room_name TEXT,
                PRIMARY KEY (nick, room_name)
            );
        `);
        console.log("=== NEBULA ENGINE READY ===");
    } catch (e) { console.error("BOOT ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    // Получить список комнат
    socket.on('req_rooms', async (nick) => {
        try {
            const res = await db.query("SELECT room_name FROM access_list WHERE nick = $1", [nick]);
            socket.emit('res_rooms', res.rows.map(r => r.room_name));
        } catch (e) { console.error(e); }
    });

    // Вступить или Создать
    socket.on('enter_room', async ({ room, nick }) => {
        try {
            // 1. Даем доступ
            await db.query("INSERT INTO access_list (nick, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nick, room]);
            
            // 2. Подключаем к сокету
            socket.rooms.forEach(r => socket.leave(r));
            socket.join(room);

            // 3. Грузим историю
            const history = await db.query("SELECT sender, content FROM chat_log WHERE room = $1 ORDER BY created_at ASC LIMIT 50", [room]);
            socket.emit('res_history', history.rows);

            // 4. Обновляем список у пользователя
            const rooms = await db.query("SELECT room_name FROM access_list WHERE nick = $1", [nick]);
            socket.emit('res_rooms', rooms.rows.map(r => r.room_name));
            
            console.log(`User ${nick} joined ${room}`);
        } catch (e) { console.error(e); }
    });

    // Добавить другого пользователя
    socket.on('invite_user', async ({ room, target }) => {
        try {
            await db.query("INSERT INTO access_list (nick, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [target, room]);
            io.emit('trigger_refresh', target);
        } catch (e) { console.error(e); }
    });

    // Сообщение
    socket.on('send_msg', async (data) => {
        try {
            await db.query("INSERT INTO chat_log (room, sender, content) VALUES ($1, $2, $3)", [data.room, data.sender, data.text]);
            io.to(data.room).emit('new_msg', data);
        } catch (e) { console.error(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
