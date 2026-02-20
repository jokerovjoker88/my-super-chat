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

async function boot() {
    try {
        await db.connect();
        // Создаем обновленную структуру таблиц
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, avatar TEXT, is_online BOOLEAN DEFAULT FALSE);
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT,
                receiver TEXT,
                content TEXT,
                file_data TEXT,
                file_name TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                reply_to_id INTEGER,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
        `);
        console.log("=== NEBULA ULTIMATE ONLINE ===");
    } catch (e) { console.error(e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('auth', async (nick) => {
        if (!nick) return;
        socket.username = nick;
        socket.join(nick);
        await db.query("INSERT INTO users (username, is_online) VALUES ($1, TRUE) ON CONFLICT (username) DO UPDATE SET is_online = TRUE", [nick]);
        const user = await db.query("SELECT avatar FROM users WHERE username = $1", [nick]);
        socket.emit('auth_ok', { avatar: user.rows[0]?.avatar });
        io.emit('status_update');
    });

    socket.on('search_user', async (target) => {
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [target]);
        const res = await db.query("SELECT username, avatar, is_online FROM users WHERE username = $1", [target]);
        socket.emit('user_found', res.rows[0]);
    });

    socket.on('typing', ({ to, from }) => { socket.to(to).emit('user_typing', { from }); });

    // ОТПРАВКА С ОТВЕТОМ
    socket.on('send_msg', async (data) => {
        const res = await db.query(
            "INSERT INTO messages (sender, receiver, content, file_data, file_name, is_read, reply_to_id) VALUES ($1, $2, $3, $4, $5, FALSE, $6) RETURNING id",
            [data.from, data.to, data.text, data.file, data.fileName, data.replyToId || null]
        );
        
        let replyText = null;
        if(data.replyToId) {
            const r = await db.query("SELECT content FROM messages WHERE id = $1", [data.replyToId]);
            replyText = r.rows[0]?.content;
        }

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(data.from).to(data.to).emit('new_msg', { 
            ...data, id: res.rows[0].id, time, replyText, is_read: false 
        });
    });

    // РЕДАКТИРОВАНИЕ
    socket.on('edit_msg', async ({ id, newText, from, to }) => {
        await db.query("UPDATE messages SET content = $1 WHERE id = $2 AND sender = $3", [newText, id, from]);
        io.to(from).to(to).emit('msg_edited', { id, newText });
    });

    socket.on('delete_msg', async ({ id, from, to }) => {
        await db.query("DELETE FROM messages WHERE id = $1 AND sender = $2", [id, from]);
        io.to(from).to(to).emit('msg_deleted', { id });
    });

    socket.on('load_chat', async ({ me, him }) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [him, me]);
        const res = await db.query(`
            SELECT m.id, m.sender, m.content, m.file_data, m.file_name, m.is_read, m.reply_to_id,
            (SELECT content FROM messages WHERE id = m.reply_to_id) as reply_text,
            to_char(m.ts, 'HH24:MI') as time 
            FROM messages m
            WHERE (m.sender=$1 AND m.receiver=$2) OR (m.sender=$2 AND m.receiver=$1) 
            ORDER BY m.ts ASC`, [me, him]);
        socket.emit('chat_history', res.rows);
        io.to(him).emit('messages_seen', { by: me }); // Уведомляем друга, что мы прочитали
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT ON (partner) partner, u.is_online, u.avatar,
            (SELECT COUNT(*) FROM messages WHERE sender = partner AND receiver = $1 AND is_read = FALSE) as unread
            FROM (SELECT receiver as partner FROM messages WHERE sender=$1 UNION SELECT sender as partner FROM messages WHERE receiver=$1) s
            JOIN users u ON u.username = s.partner`, [me]);
        socket.emit('dialogs_list', res.rows);
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            await db.query("UPDATE users SET is_online = FALSE WHERE username = $1", [socket.username]);
            io.emit('status_update');
        }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
