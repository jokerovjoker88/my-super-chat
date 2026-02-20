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

let isDbReady = false;
db.connect().then(() => {
    isDbReady = true;
    // Таблица сообщений с привязкой к комнате
    db.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, username TEXT, content TEXT, 
        room TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Таблица доступов (кто в какой комнате может сидеть)
    db.query(`CREATE TABLE IF NOT EXISTS room_access (
        username TEXT, room TEXT, PRIMARY KEY (username, room)
    )`);
}).catch(e => console.error("DB Error:", e));

io.on('connection', (socket) => {
    // Вход в систему и получение списка МОИХ комнат
    socket.on('get my rooms', async (username) => {
        if (!isDbReady) return;
        const res = await db.query("SELECT room FROM room_access WHERE username = $1", [username]);
        socket.emit('rooms list', res.rows.map(r => r.room));
    });

    // Создание новой комнаты
    socket.on('create room', async ({ room, creator }) => {
        try {
            await db.query("INSERT INTO room_access (username, room) VALUES ($1, $2) ON CONFLICT DO NOTHING", [creator, room]);
            socket.emit('room created', room);
        } catch (e) { console.error(e); }
    });

    // Добавление пользователя в комнату
    socket.on('invite user', async ({ room, targetUser }) => {
        try {
            await db.query("INSERT INTO room_access (username, room) VALUES ($1, $2) ON CONFLICT DO NOTHING", [targetUser, room]);
            // Уведомляем всех, если пользователь в сети
            io.emit('new invite', { room, targetUser });
        } catch (e) { console.error(e); }
    });

    socket.on('join room', async ({ username, room }) => {
        socket.join(room);
        if (isDbReady) {
            const res = await db.query("SELECT * FROM messages WHERE room = $1 ORDER BY created_at ASC", [room]);
            socket.emit('load history', res.rows);
        }
    });

    socket.on('chat message', async (data) => {
        const { user, text, room } = data;
        const res = await db.query(
            "INSERT INTO messages (username, content, room) VALUES ($1, $2, $3) RETURNING id",
            [user, text, room]
        );
        io.to(room).emit('chat message', {
            id: res.rows[0].id, username: user, content: text, room: room,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
