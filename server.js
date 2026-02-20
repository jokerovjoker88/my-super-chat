const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client } = require('pg'); // Подключаем драйвер PostgreSQL

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // Лимит 100мб для передачи файлов
});

app.use(express.static(path.join(__dirname, 'public')));

// 1. Настройка подключения к PostgreSQL через переменную окружения Render
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Обязательно для облачных баз
});

// 2. Подключаемся и создаем таблицу
db.connect()
    .then(() => {
        console.log('Успешно подключено к PostgreSQL');
        return db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                username TEXT,
                content TEXT,
                room TEXT,
                msg_type TEXT,
                file_name TEXT,
                file_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    })
    .catch(err => console.error('Ошибка БД:', err));

let onlineUsers = {};

io.on('connection', (socket) => {
    // Вход в чат
    socket.on('join', async (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username, room: 'general' };
        socket.join('general');

        // Загружаем историю из БД
        try {
            const res = await db.query(
                "SELECT * FROM messages WHERE room = 'general' ORDER BY created_at DESC LIMIT 50"
            );
            socket.emit('load history', res.rows.reverse());
        } catch (err) { console.error('Ошибка загрузки истории:', err); }

        io.emit('update online', Object.values(onlineUsers));
    });

    // Обработка сообщения
    socket.on('chat message', async (data) => {
        const { user, text, room, file, fileName, fileType, audio } = data;
        let msg_type = 'text';
        let content = text;

        if (file) { msg_type = 'file'; content = file; }
        else if (audio) { msg_type = 'audio'; content = audio; }

        // Сохраняем в PostgreSQL
        try {
            await db.query(
                "INSERT INTO messages (username, content, room, msg_type, file_name, file_type) VALUES ($1, $2, $3, $4, $5, $6)",
                [user, content, room, msg_type, fileName || null, fileType || null]
            );
        } catch (err) { console.error('Ошибка сохранения в БД:', err); }

        io.to(room).emit('chat message', {
            ...data,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Переключение комнат (приват)
    socket.on('join room', async (roomName) => {
        socket.leaveAll();
        socket.join(roomName);
        if (onlineUsers[socket.id]) onlineUsers[socket.id].room = roomName;

        try {
            const res = await db.query(
                "SELECT * FROM messages WHERE room = $1 ORDER BY created_at DESC LIMIT 50",
                [roomName]
            );
            socket.emit('load history', res.rows.reverse());
        } catch (err) { console.error(err); }
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('user typing', { user: data.user });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
