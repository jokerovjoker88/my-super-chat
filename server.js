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
    db.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, username TEXT, content TEXT, 
        msg_type TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}).catch(e => console.error(e));

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.username = data.username;
        socket.join('general');
        if (isDbReady) {
            const res = await db.query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 50");
            socket.emit('load history', res.rows.reverse());
        }
    });

    socket.on('chat message', async (data) => {
        if (!isDbReady) return;
        const res = await db.query(
            "INSERT INTO messages (username, content, msg_type) VALUES ($1, $2, $3) RETURNING id",
            [data.user, data.text, 'text']
        );
        io.emit('chat message', {
            id: res.rows[0].id, username: data.user, content: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('delete message', async (id) => {
        if (isDbReady) {
            await db.query("DELETE FROM messages WHERE id = $1", [id]);
            io.emit('message deleted', id);
        }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
