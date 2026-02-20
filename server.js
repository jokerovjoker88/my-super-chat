const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    connectionStateRecovery: {} // Восстановление при обрыве связи
});

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function start() {
    try {
        await db.connect();
        // Создаем таблицы с правильными связями
        await db.query(`
            CREATE TABLE IF NOT EXISTS rooms_data (
                room_id TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS room_members (
                room_id TEXT REFERENCES rooms_data(room_id) ON DELETE CASCADE,
                user_nick TEXT,
                PRIMARY KEY (room_id, user_nick)
            );
            CREATE TABLE IF NOT EXISTS messages_log (
                id SERIAL PRIMARY KEY,
                sender TEXT,
                txt TEXT,
                room TEXT REFERENCES rooms_data(room_id) ON DELETE CASCADE,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("System Online: DB Ready");
    } catch (e) { console.error("Critical DB Error:", e); }
}
start();

io.on('connection', (socket) => {
    // Получить список чатов
    socket.on('fetch_rooms', async (nick) => {
        const res = await db.query("SELECT room_id FROM room_members WHERE user_nick = $1", [nick]);
        socket.emit('rooms_update', res.rows.map(r => r.room_id));
    });

    // Создать/Вступить
    socket.on('access_room', async ({ room, nick }) => {
        try {
            await db.query("INSERT INTO rooms_data (room_id) VALUES ($1) ON CONFLICT DO NOTHING", [room]);
            await db.query("INSERT INTO room_members (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, nick]);
            socket.emit('access_granted', room);
        } catch (e) { console.error(e); }
    });

    // Пригласить друга
    socket.on('invite_friend', async ({ room, friend }) => {
        try {
            await db.query("INSERT INTO room_members (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, friend]);
            io.emit('notify_invite', friend); 
        } catch (e) { console.error(e); }
    });

    // Вход в чат
    socket.on('join_session', async ({ room }) => {
        socket.rooms.forEach(r => socket.leave(r)); // Выйти из старых
        socket.join(room);
        const res = await db.query("SELECT sender, txt FROM messages_log WHERE room = $1 ORDER BY ts ASC LIMIT 100", [room]);
        socket.emit('chat_history', res.rows);
    });

    // Сообщение
    socket.on('push_msg', async (data) => {
        await db.query("INSERT INTO messages_log (sender, txt, room) VALUES ($1, $2, $3)", [data.nick, data.txt, data.room]);
        io.to(data.room).emit('broadcast_msg', data);
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
