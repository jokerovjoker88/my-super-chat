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
    // Добавляем колонку room в таблицу, если её нет
    db.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, 
        username TEXT, 
        content TEXT, 
        room TEXT, 
        msg_type TEXT, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}).catch(e => console.error(e));

io.on('connection', (socket) => {
    socket.on('join room', async (data) => {
        const { username, room } = data;
        
        // Покидаем предыдущие комнаты
        Array.from(socket.rooms).forEach(r => { if(r !== socket.id) socket.leave(r); });
        
        socket.join(room);
        socket.username = username;
        socket.currentRoom = room;

        console.log(`${username} зашел в комнату: ${room}`);

        if (isDbReady) {
            try {
                // Подгружаем историю ТОЛЬКО для этой комнаты
                const res = await db.query(
                    "SELECT * FROM messages WHERE room = $1 ORDER BY created_at DESC LIMIT 50", 
                    [room]
                );
                socket.emit('load history', res.rows.reverse());
            } catch (err) { console.error(err); }
        }
    });

    socket.on('chat message', async (data) => {
        if (!isDbReady) return;
        const { user, text, room } = data;

        try {
            const res = await db.query(
                "INSERT INTO messages (username, content, room, msg_type) VALUES ($1, $2, $3, $4) RETURNING id",
                [user, text, room, 'text']
            );
            
            // Отправляем сообщение ТОЛЬКО участникам этой комнаты
            io.to(room).emit('chat message', {
                id: res.rows[0].id,
                username: user,
                content: text,
                room: room,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } catch (err) { console.error(err); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
