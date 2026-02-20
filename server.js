const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function setup() {
    try {
        await db.connect();
        // Мы НЕ удаляем таблицы каждый раз, а просто создаем их, если их нет
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
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
        console.log("=== NEBULA SYSTEM READY ===");
    } catch (e) { console.error("Setup Error:", e); }
}
setup();

io.on('connection', (socket) => {
    socket.on('auth', async (nick) => {
        if (!nick) return;
        try {
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET last_seen = NOW()", [nick]);
            socket.username = nick;
            socket.join(nick);
            socket.emit('auth_ok');
        } catch (e) { console.error("Auth error:", e); }
    });

    socket.on('search_user', async (target) => {
        const res = await db.query("SELECT username FROM users WHERE username = $1", [target]);
        if (res.rows.length > 0) {
            socket.emit('user_found', res.rows[0].username);
        } else {
            socket.emit('error_msg', 'Пользователь не найден. Он должен хотя бы раз зайти в мессенджер.');
        }
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
            SELECT sender, content, file_data, file_name, ts FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
            ORDER BY ts ASC
        `, [me, him]);
        socket.emit('chat_history', res.rows);
    });

    socket.on('send_msg', async (data) => {
        try {
            // ФИКС ОШИБКИ: Гарантируем, что оба пользователя есть в базе перед отправкой
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [data.from]);
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [data.to]);

            await db.query(
                "INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5)",
                [data.from, data.to, data.text, data.file || null, data.fileName || null]
            );
            io.to(data.from).to(data.to).emit('new_msg', data);
        } catch (e) { 
            console.error("Critical Send Error:", e.message);
            socket.emit('error_msg', 'Ошибка отправки: ' + e.message);
        }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
