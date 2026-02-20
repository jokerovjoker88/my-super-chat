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

async function start() {
    try {
        await db.connect();
        // Добавляем колонку avatar, если её нет
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                avatar TEXT, 
                is_online BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(username),
                receiver TEXT REFERENCES users(username),
                content TEXT,
                file_data TEXT,
                file_name TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA ULTIMATE ONLINE ===");
    } catch (e) { console.error(e); }
}
start();

io.on('connection', (socket) => {
    socket.on('auth', async (nick) => {
        if (!nick) return;
        // При входе ставим статус онлайн
        await db.query("INSERT INTO users (username, is_online) VALUES ($1, TRUE) ON CONFLICT (username) DO UPDATE SET is_online = TRUE", [nick]);
        socket.username = nick;
        socket.join(nick);
        
        const userRes = await db.query("SELECT avatar FROM users WHERE username = $1", [nick]);
        socket.emit('auth_ok', { avatar: userRes.rows[0]?.avatar });
        io.emit('user_status_change', { username: nick, online: TRUE });
    });

    // Обновление аватарки
    socket.on('update_avatar', async (imgData) => {
        await db.query("UPDATE users SET avatar = $1 WHERE username = $2", [imgData, socket.username]);
        socket.emit('avatar_updated', imgData);
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT ON (partner) 
                partner, 
                u.is_online, 
                u.avatar,
                (SELECT COUNT(*) FROM messages WHERE sender = partner AND receiver = $1 AND is_read = FALSE) as unread_count
            FROM (
                SELECT receiver as partner FROM messages WHERE sender = $1
                UNION
                SELECT sender as partner FROM messages WHERE receiver = $1
            ) s
            JOIN users u ON u.username = s.partner
        `, [me]);
        socket.emit('dialogs_list', res.rows);
    });

    socket.on('load_chat', async ({ me, him }) => {
        // Помечаем сообщения как прочитанные
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [him, me]);
        
        const res = await db.query(`
            SELECT sender, content, file_data, file_name, to_char(ts, 'HH24:MI') as time 
            FROM messages WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
            ORDER BY ts ASC
        `, [me, him]);
        socket.emit('chat_history', res.rows);
        io.to(him).emit('messages_read', { by: me });
    });

    socket.on('send_msg', async (data) => {
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [data.to]);
        await db.query(
            "INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5)",
            [data.from, data.to, data.text, data.file || null, data.fileName || null]
        );
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(data.from).to(data.to).emit('new_msg', { ...data, time });
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            await db.query("UPDATE users SET is_online = FALSE WHERE username = $1", [socket.username]);
            io.emit('user_status_change', { username: socket.username, online: FALSE });
        }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
