const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Функции кодирования для БД
const encode = (t) => Buffer.from(t).toString('base64');
const decode = (t) => Buffer.from(t, 'base64').toString('utf-8');

async function boot() {
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, email TEXT, password TEXT, avatar TEXT, is_online BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, content TEXT, 
                file_data TEXT, file_name TEXT, is_read BOOLEAN DEFAULT FALSE, ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("=== NEBULA SECURE SERVER ONLINE ===");
    } catch (e) { console.error("DB ERROR:", e); }
}
boot();

io.on('connection', (socket) => {
    socket.on('register', async ({ nick, email, pass }) => {
        try {
            const check = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
            if (check.rows.length > 0) return socket.emit('auth_error', 'Ник занят');
            const hashed = await bcrypt.hash(pass, 10);
            await db.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [nick, email, hashed]);
            socket.emit('auth_success', 'Регистрация успешна!');
        } catch (e) { socket.emit('auth_error', 'Ошибка регистрации'); }
    });

    socket.on('login', async ({ nick, pass }) => {
        const res = await db.query("SELECT * FROM users WHERE username = $1", [nick]);
        const user = res.rows[0];
        if (!user || !(await bcrypt.compare(pass, user.password))) {
            return socket.emit('auth_error', 'Неверный логин или пароль');
        }
        socket.username = nick;
        socket.join(nick);
        await db.query("UPDATE users SET is_online = TRUE WHERE username = $1", [nick]);
        socket.emit('auth_ok', { nick });
        io.emit('status_update');
    });

    socket.on('send_msg', async (d) => {
        const safeText = d.text ? encode(d.text) : null;
        const res = await db.query("INSERT INTO messages (sender, receiver, content, file_data, file_name) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
            [d.from, d.to, safeText, d.file, d.fileName]);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(d.from).to(d.to).emit('new_msg', { ...d, id: res.rows[0].id, time, is_read: false });
    });

    socket.on('load_chat', async ({ me, him }) => {
        await db.query("UPDATE messages SET is_read = TRUE WHERE sender = $1 AND receiver = $2", [him, me]);
        const res = await db.query(`SELECT *, to_char(ts, 'HH24:MI') as time FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) ORDER BY ts ASC`, [me, him]);
        const history = res.rows.map(m => ({ ...m, content: m.content ? decode(m.content) : null }));
        socket.emit('chat_history', history);
    });

    socket.on('search_user', async (target) => {
        const res = await db.query("SELECT username FROM users WHERE username = $1", [target]);
        if (res.rows[0]) socket.emit('user_found', res.rows[0]);
        else socket.emit('auth_error', 'Пользователь не найден');
    });

    socket.on('get_my_dialogs', async (me) => {
        const res = await db.query(`
            SELECT DISTINCT ON (partner) partner, 
            (SELECT COUNT(*) FROM messages WHERE sender = partner AND receiver = $1 AND is_read = FALSE) as unread
            FROM (SELECT receiver as partner FROM messages WHERE sender = $1 UNION SELECT sender as partner FROM messages WHERE receiver = $1) s
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

server.listen(process.env.PORT || 10000);
