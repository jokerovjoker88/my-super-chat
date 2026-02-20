const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100mb
});

app.use(express.static(path.join(__dirname, 'public')));

// Настройка базы с защитой от сбоев
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let isDbReady = false;

db.connect()
    .then(() => {
        console.log('✅ ПОДКЛЮЧЕНО К POSTGRESQL');
        isDbReady = true;
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
    .catch(err => {
        console.error('❌ ОШИБКА БАЗЫ (Чат работает в демо-режиме):', err.message);
        isDbReady = false;
    });

let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username, room: 'general' };
        socket.join('general');

        // Загружаем историю только если база готова
        if (isDbReady) {
            try {
                const res = await db.query(
                    "SELECT * FROM messages WHERE room = 'general' ORDER BY created_at DESC LIMIT 50"
                );
                socket.emit('load history', res.rows.reverse());
            } catch (err) { console.error('Ошибка истории:', err.message); }
        }

        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', async (data) => {
        const { user, text, room, file, fileName, fileType, audio } = data;
        let msg_type = 'text', content = text;
        if (file) { msg_type = 'file'; content = file; }
        else if (audio) { msg_type = 'audio'; content = audio; }

        // Пытаемся сохранить, но не ждем ответа, чтобы не тормозить чат
        if (isDbReady) {
            db.query(
                "INSERT INTO messages (username, content, room, msg_type, file_name, file_type) VALUES ($1, $2, $3, $4, $5, $6)",
                [user, content, room, msg_type, fileName || null, fileType || null]
            ).catch(e => console.error('Ошибка записи:', e.message));
        }

        // Сразу отправляем сообщение всем (не дожидаясь базы)
        io.to(room).emit('chat message', {
            ...data,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('join room', async (roomName) => {
        socket.leaveAll();
        socket.join(roomName);
        if (onlineUsers[socket.id]) onlineUsers[socket.id].room = roomName;

        if (isDbReady) {
            try {
                const res = await db.query("SELECT * FROM messages WHERE room = $1 ORDER BY created_at DESC LIMIT 50", [roomName]);
                socket.emit('load history', res.rows.reverse());
            } catch (err) { console.error(err); }
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('user typing', { user: data.user });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Сервер на порту ${PORT}`));
