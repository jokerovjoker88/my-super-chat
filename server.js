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

let dbStatus = "🔴 База не подключена";

// Запуск базы
db.connect()
    .then(() => {
        dbStatus = "🟢 БД Работает";
        console.log("DB Connected!");
        return db.query(`
            CREATE TABLE IF NOT EXISTS my_rooms (
                username TEXT, room_name TEXT, PRIMARY KEY (username, room_name)
            );
            CREATE TABLE IF NOT EXISTS my_messages (
                id SERIAL PRIMARY KEY, room_name TEXT, sender TEXT, msg_text TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    })
    .catch(e => console.error("DB Error:", e));

io.on('connection', (socket) => {
    socket.emit('server_status', dbStatus);

    // Загрузка меню слева
    socket.on('load_rooms', async (nick) => {
        try {
            const res = await db.query("SELECT room_name FROM my_rooms WHERE username = $1", [nick]);
            socket.emit('rooms_list', res.rows.map(r => r.room_name));
        } catch (e) {}
    });

    // Создать или войти в чат
    socket.on('join_room', async ({ room, nick }) => {
        try {
            await db.query("INSERT INTO my_rooms (username, room_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nick, room]);
            
            socket.rooms.forEach(r => socket.leave(r));
            socket.join(room);

            const hist = await db.query("SELECT sender, msg_text FROM my_messages WHERE room_name = $1 ORDER BY created_at ASC LIMIT 100", [room]);
            socket.emit('room_joined', { room: room, history: hist.rows });

            const res = await db.query("SELECT room_name FROM my_rooms WHERE username = $1", [nick]);
            socket.emit('rooms_list', res.rows.map(r => r.room_name));
        } catch (e) { console.error(e); }
    });

    // Отправить сообщение
    socket.on('send_msg', async ({ room, sender, text }) => {
        try {
            await db.query("INSERT INTO my_messages (room_name, sender, msg_text) VALUES ($1, $2, $3)", [room, sender, text]);
            io.to(room).emit('new_msg', { room, sender, text });
        } catch (e) { console.error(e); }
    });

    // НОВОЕ: Отправка приглашения
    socket.on('send_invite', ({ from, to, room }) => {
        // Рассылаем всем, но на клиенте сработает только у нужного юзера
        io.emit('incoming_invite', { from, to, room });
    });
});

server.listen(process.env.PORT || 10000, () => console.log('Server online'));
