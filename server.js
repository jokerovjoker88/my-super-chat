const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 60000, // Держим соединение с телефоном дольше
    maxHttpBufferSize: 1e7 
});

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function start() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(username),
                receiver TEXT REFERENCES users(username),
                content TEXT,
                file_data TEXT,
                file_name TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== TG-ENGINE V5: REALTIME READY ===");
    } catch (e) { console.error(e); }
}
start();

io.on('connection', (socket) => {
    socket.on('auth', async (nick) => {
        if (!nick) return;
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [nick]);
        socket.username = nick;
        socket.join(nick); // Создаем персональную комнату по нику
        socket.emit('auth_ok');
    });

    socket.on('search_user', async (target) => {
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [target]);
        socket.emit('user_found', target);
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT CASE WHEN sender = $1 THEN receiver ELSE sender END as partner
            FROM messages WHERE sender = $1 OR receiver = $1
        `, [me]);
        socket.emit('dialogs_list', res.rows);
    });

    socket.on('load_chat', async ({ me, him }) => {
        const res = await db.query(`
            SELECT sender, content, file_data, file_name, to_char(ts, 'HH24:MI') as time 
            FROM messages WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
            ORDER BY ts ASC
        `, [me, him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (data) => {
        try {
            await db.query(
                "INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5)",
                [data.from, data.to, data.text, data.file || null, data.fileName || null]
            );
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // МГНОВЕННАЯ ОТПРАВКА ОБОИМ (через комнаты Socket.io)
            io.to(data.from).to(data.to).emit('new_msg', { ...data, time });
            
            // Сигнал обновить список чатов для получателя
            io.to(data.to).emit('update_chats');
        } catch (e) { console.error(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
