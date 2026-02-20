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

async function initDB() {
    try {
        await db.connect();
        // Сообщения
        await db.query(`CREATE TABLE IF NOT EXISTS msgs (
            id SERIAL PRIMARY KEY, sender TEXT, txt TEXT, room TEXT, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        // Доступы (кто в каких чатах состоит)
        await db.query(`CREATE TABLE IF NOT EXISTS room_users (
            room_id TEXT, user_nick TEXT, PRIMARY KEY (room_id, user_nick)
        )`);
        console.log("Database Connected & Synced");
    } catch (e) { console.error("DB Error:", e); }
}
initDB();

io.on('connection', (socket) => {
    // Список чатов пользователя
    socket.on('get_rooms', async (nick) => {
        const res = await db.query("SELECT room_id FROM room_users WHERE user_nick = $1", [nick]);
        socket.emit('list_rooms', res.rows.map(r => r.room_id));
    });

    // Создать или Вступить в чат
    socket.on('join_new_room', async ({ room, nick }) => {
        try {
            await db.query("INSERT INTO room_users (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, nick]);
            socket.emit('update_ui', room); 
        } catch (e) { console.error(e); }
    });

    // Добавить другого (приглашение)
    socket.on('add_friend', async ({ room, friend }) => {
        try {
            await db.query("INSERT INTO room_users (room_id, user_nick) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, friend]);
            io.emit('refresh_for', friend);
        } catch (e) { console.error(e); }
    });

    // Загрузка сообщений
    socket.on('join_chat', async ({ room }) => {
        socket.join(room);
        const res = await db.query("SELECT * FROM msgs WHERE room = $1 ORDER BY ts ASC", [room]);
        socket.emit('history', res.rows);
    });

    // Отправка
    socket.on('msg', async (data) => {
        await db.query("INSERT INTO msgs (sender, txt, room) VALUES ($1, $2, $3)", [data.nick, data.txt, data.room]);
        io.to(data.room).emit('new_msg', data);
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
