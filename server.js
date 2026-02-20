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
        // Упрощенная схема: только сообщения и список комнат пользователя
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_msgs (
                id SERIAL PRIMARY KEY,
                room TEXT,
                sender TEXT,
                text TEXT,
                time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_rooms (
                username TEXT,
                room_name TEXT,
                PRIMARY KEY (username, room_name)
            );
        `);
        console.log("DB READY");
    } catch (e) { console.error("DB ERROR", e); }
}
init();

io.on('connection', (socket) => {
    // 1. Загрузка чатов при входе
    socket.on('get_my_rooms', async (nick) => {
        const res = await db.query("SELECT room_name FROM user_rooms WHERE username = $1", [nick]);
        socket.emit('rooms_list', res.rows.map(r => r.room_name));
    });

    // 2. Создание или вступление в чат
    socket.on('join_room', async ({ room, nick }) => {
        try {
            socket.rooms.forEach(r => socket.leave(r)); 
            socket.join(room);
            
            // Добавляем в список доступных чатов
            await db.query("INSERT INTO user_rooms (username, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nick, room]);
            
            // Грузим историю
            const history = await db.query("SELECT sender, text FROM chat_msgs WHERE room = $1 ORDER BY time ASC", [room]);
            socket.emit('history', history.rows);
            
            // Обновляем список чатов у юзера
            const myRooms = await db.query("SELECT room_name FROM user_rooms WHERE username = $1", [nick]);
            socket.emit('rooms_list', myRooms.rows.map(r => r.room_name));
            
        } catch (e) { console.log(e); }
    });

    // 3. Добавление другого пользователя (Приглашение)
    socket.on('add_user', async ({ room, targetNick }) => {
        try {
            await db.query("INSERT INTO user_rooms (username, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [targetNick, room]);
            io.emit('check_new_rooms', targetNick); // Пингуем всех, нужный юзер обновится
        } catch (e) { console.log(e); }
    });

    // 4. Отправка сообщения
    socket.on('send_msg', async (data) => {
        try {
            const { room, sender, text } = data;
            if(!room || !text) return;
            
            await db.query("INSERT INTO chat_msgs (room, sender, text) VALUES ($1, $2, $3)", [room, sender, text]);
            io.to(room).emit('new_msg', { sender, text, room });
        } catch (e) { console.log(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
