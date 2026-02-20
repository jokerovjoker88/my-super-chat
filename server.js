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
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
        `);
        console.log("=== SERVER ONLINE: STABLE VERSION ===");
    } catch (e) { console.error("DB ERROR:", e); }
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

    socket.on('typing', ({ to, from }) => {
        socket.to(to).emit('user_typing', { from });
    });

    socket.on('search_user', async (target) => {
        if (!target) return;
        await db.query("INSERT INTO users (username) VALUES ($1) ON CONFLICT DO NOTHING", [target]);
        const res = await db.query("SELECT username, avatar, is_online FROM users WHERE username = $1", [target]);
        socket.emit('user_found', res.rows[0]);
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT ON (partner) partner, u.is_online, u.avatar,
            (SELECT COUNT(*) FROM messages WHERE sender = partner AND receiver = $1 AND is_read = FALSE) as unread
            FROM (SELECT receiver as partner FROM messages WHERE sender = $1 UNION SELECT sender as partner FROM messages WHERE receiver = $1) s
            JOIN users u ON u.username = s.partner`, [me]);
        socket.emit('dialogs_list', res.rows);
    });

    socket.on('load_chat', async ({ me, him }) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [him, me]);
        const res = await db.query(`SELECT id, sender, content, file_data, file_name, is_read, to_char(ts, 'HH24:MI') as time FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) ORDER BY ts ASC`, [me, him]);
        socket.emit('chat_history', res.rows);
        io.to(him).emit('messages_read_by_partner', { partner: me });
    });

    socket.on('send_msg', async (d) => {
        const res = await db.query("INSERT INTO messages (sender, receiver, content, file_data, file_name, is_read) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id", 
            [d.from, d.to, d.text, d.file || null, d.fileName || null]);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(d.from).to(d.to).emit('new_msg', { ...d, id: res.rows[0].id, time, is_read: false });
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            await db.query("UPDATE users SET is_online = FALSE WHERE username = $1", [socket.username]);
            io.emit('status_update');
        }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
