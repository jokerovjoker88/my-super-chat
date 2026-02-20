const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static(path.join(__dirname, 'public')));

// Подключение к базе данных PostgreSQL
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

let isDbReady = false;

db.connect()
    .then(() => {
        console.log('✅ УСПЕШНО: Подключено к PostgreSQL');
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
    .catch(err => console.error('❌ ОШИБКА БАЗЫ:', err.message));

let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username };
        socket.join('general');

        if (isDbReady) {
            try {
                const res = await db.query("SELECT * FROM messages WHERE room = 'general' ORDER BY created_at DESC LIMIT 50");
                socket.emit('load history', res.rows.reverse());
            } catch (err) { console.error(err); }
        }
        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', async (data) => {
        const { user, text, room, file, fileName, fileType, audio } = data;
        let type = 'text', content = text;
        if (file) { type = 'file'; content = file; }
        else if (audio) { type = 'audio'; content = audio; }

        if (isDbReady) {
            try {
                const res = await db.query(
                    "INSERT INTO messages (username, content, room, msg_type, file_name, file_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
                    [user, content, room, type, fileName || null, fileType || null]
                );
                
                io.to(room).emit('chat message', {
                    id: res.rows[0].id,
                    username: user,
                    content: content,
                    msg_type: type,
                    file_name: fileName,
                    file_type: fileType,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            } catch (err) { console.error(err); }
        }
    });

    socket.on('delete message', async (id) => {
        if (isDbReady) {
            await db.query("DELETE FROM messages WHERE id = $1", [id]);
            io.emit('message deleted', id);
        }
    });

    socket.on('typing', (data) => {
        socket.to('general').emit('display typing', data);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер на порту ${PORT}`));
