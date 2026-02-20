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
}).catch(e => console.error(e));

let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username };
        socket.join('general');
        if (isDbReady) {
            try {
                const res = await db.query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 50");
                socket.emit('load history', res.rows.reverse());
            } catch (err) { console.error(err); }
        }
        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', async (data) => {
        if (!isDbReady) return;
        const res = await db.query(
            "INSERT INTO messages (username, content, room, msg_type, file_name, file_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [data.user, data.file || data.text, 'general', data.file ? 'file' : 'text', data.fileName, data.fileType]
        );
        io.emit('chat message', {
            id: res.rows[0].id,
            username: data.user,
            content: data.file || data.text,
            msg_type: data.file ? 'file' : 'text',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('delete message', async (id) => {
        if (isDbReady) {
            await db.query("DELETE FROM messages WHERE id = $1", [id]);
            io.emit('message deleted', id);
        }
    });

    socket.on('typing', (data) => socket.to('general').emit('display typing', data));
    
    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log('Server OK'));
