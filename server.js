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

async function startSystem() {
    try {
        await db.connect();
        console.log("DB Connected. Cleaning old tables...");
        
        // ВНИМАНИЕ: Очистка для исправления ошибок структуры
        await db.query(`
            DROP TABLE IF EXISTS chat_msgs CASCADE;
            DROP TABLE IF EXISTS user_rooms CASCADE;
            
            CREATE TABLE user_rooms (
                username TEXT,
                room_name TEXT,
                PRIMARY KEY (username, room_name)
            );
            
            CREATE TABLE chat_msgs (
                id SERIAL PRIMARY KEY,
                room TEXT,
                sender TEXT,
                text TEXT,
                time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("System Reconfigured: Tables Ready");
    } catch (e) { console.error("Critical Start Error:", e); }
}
startSystem();

io.on('connection', (socket) => {
    // Получение списка чатов
    socket.on('get_my_rooms', async (nick) => {
        try {
            const res = await db.query("SELECT room_name FROM user_rooms WHERE username = $1", [nick]);
            socket.emit('rooms_list', res.rows.map(r => r.room_name));
        } catch(e) { console.log(e); }
    });

    // Вступление/Создание
    socket.on('join_room', async ({ room, nick }) => {
        try {
            socket.rooms.forEach(r => socket.leave(r));
            socket.join(room);
            await db.query("INSERT INTO user_rooms (username, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nick, room]);
            
            const history = await db.query("SELECT sender, text FROM chat_msgs WHERE room = $1 ORDER BY time ASC", [room]);
            socket.emit('history', history.rows);
            
            const myRooms = await db.query("SELECT room_name FROM user_rooms WHERE username = $1", [nick]);
            socket.emit('rooms_list', myRooms.rows.map(r => r.room_name));
        } catch(e) { console.log(e); }
    });

    // Добавление пользователя
    socket.on('add_user', async ({ room, targetNick }) => {
        try {
            await db.query("INSERT INTO user_rooms (username, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [targetNick, room]);
            io.emit('ping_update', targetNick);
        } catch(e) { console.log(e); }
    });

    // Сообщение
    socket.on('send_msg', async (data) => {
        try {
            await db.query("INSERT INTO chat_msgs (room, sender, text) VALUES ($1, $2, $3)", [data.room, data.sender, data.text]);
            io.to(data.room).emit('new_msg', data);
        } catch(e) { console.log(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
