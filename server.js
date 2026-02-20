const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 }); // 10MB limit

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function setup() {
    try {
        await db.connect();
        // Стираем старые ошибки и создаем чистую структуру
        await db.query(`
            DROP TABLE IF EXISTS messages CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            
            CREATE TABLE users (
                username TEXT PRIMARY KEY,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(username),
                receiver TEXT REFERENCES users(username),
                content TEXT,
                file_data TEXT, -- Для картинок
                file_name TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA CORE: SYSTEM READY ===");
    } catch (e) { console.error("Setup Error:", e); }
}
setup();

io.on('connection', (socket) => {
    // Авторизация / Регистрация
    socket.on('auth', async (nick) => {
        try {
            await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET last_seen = NOW()", [nick]);
            socket.username = nick;
            socket.join(nick);
            socket.emit('auth_ok');
        } catch (e) { console.log(e); }
    });

    // Поиск пользователя для нового чата
    socket.on('search_user', async (target) => {
        const res = await db.query("SELECT username FROM users WHERE username = $1", [target]);
        if (res.rows.length > 0) {
            socket.emit('user_found', res.rows[0].username);
        } else {
            socket.emit('error_msg', 'Пользователь не найден');
        }
    });

    // Список моих диалогов (как в Telegram)
    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT CASE WHEN sender = $1 THEN receiver ELSE sender END as partner
            FROM messages WHERE sender = $1 OR receiver = $1
            ORDER BY partner ASC
        `, [me]);
        socket.emit('dialogs_list', res.rows);
    });

    // История переписки
    socket.on('load_chat', async ({ me, him }) => {
        const res = await db.query(`
            SELECT sender, content, file_data, file_name, ts FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
            ORDER BY ts ASC
        `, [me, him]);
        socket.emit('chat_history', res.rows);
    });

    // Отправка сообщения (текст + файл)
    socket.on('send_msg', async (data) => {
        try {
            await db.query(
                "INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5)",
                [data.from, data.to, data.text, data.file || null, data.fileName || null]
            );
            // Отправляем обоим
            io.to(data.from).to(data.to).emit('new_msg', data);
        } catch (e) { console.log(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
