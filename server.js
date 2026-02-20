const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8, cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

db.connect().then(() => {
    db.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, username TEXT, content TEXT, 
        msg_type TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}).catch(e => console.error("DB Error", e));

io.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.username = data.username;
        socket.join('general');
        try {
            const res = await db.query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 50");
            socket.emit('load history', res.rows.reverse());
        } catch (err) { console.error(err); }
    });

    socket.on('chat message', async (data) => {
        const res = await db.query(
            "INSERT INTO messages (username, content, msg_type) VALUES ($1, $2, $3) RETURNING id",
            [data.user, data.file || data.text, data.file ? 'file' : 'text']
        );
        io.emit('chat message', {
            id: res.rows[0].id, username: data.user,
            content: data.file || data.text, msg_type: data.file ? 'file' : 'text',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('delete message', async (id) => {
        await db.query("DELETE FROM messages WHERE id = $1", [id]);
        io.emit('message deleted', id);
    });

    socket.on('typing', (d) => socket.to('general').emit('display typing', d));
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
