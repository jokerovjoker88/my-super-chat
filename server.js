const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static(path.join(__dirname, 'public')));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

db.connect().then(() => {
    // Таблица сообщений
    db.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, username TEXT, content TEXT, 
        room TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Таблица комнат и их участников
    db.query(`CREATE TABLE IF NOT EXISTS rooms (
        room_name TEXT, username TEXT, PRIMARY KEY (room_name, username)
    )`);
}).catch(e => console.error("DB Error:", e));

io.on('connection', (socket) => {
    // При входе грузим список комнат пользователя
    socket.on('get_my_rooms', async (username) => {
        const res = await db.query("SELECT room_name FROM rooms WHERE username = $1", [username]);
        socket.emit('rooms_list', res.rows.map(r => r.room_name));
    });

    // Создание комнаты
    socket.on('create_room', async ({ room, user }) => {
        try {
            await db.query("INSERT INTO rooms (room_name, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, user]);
            socket.emit('room_update');
        } catch (e) { console.error(e); }
    });

    // Добавление другого пользователя
    socket.on('add_user_to_room', async ({ room, targetUser }) => {
        try {
            await db.query("INSERT INTO rooms (room_name, username) VALUES ($1, $2) ON CONFLICT DO NOTHING", [room, targetUser]);
            io.emit('check_invites', targetUser); // Сигнал всем: проверьте, не добавили ли вас
        } catch (e) { console.error(e); }
    });

    // Вход в конкретную комнату
    socket.on('join_room', async ({ room, user }) => {
        socket.join(room);
        const res = await db.query("SELECT * FROM messages WHERE room = $1 ORDER BY created_at ASC", [room]);
        socket.emit('history', res.rows);
    });

    // Отправка сообщения
    socket.on('send_msg', async (data) => {
        const { user, text, room } = data;
        if (!room) return;
        const res = await db.query("INSERT INTO messages (username, content, room) VALUES ($1, $2, $3) RETURNING id", [user, text, room]);
        io.to(room).emit('new_msg', {
            id: res.rows[0].id, username: user, content: text, room: room,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
