const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startDB() {
    try {
        await db.connect();
        // Удаляем все старое, чтобы не было конфликтов
        await db.query('DROP TABLE IF EXISTS messages');
        // Создаем заново идеальную таблицу
        await db.query(`
            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                sender TEXT,
                receiver TEXT,
                txt TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("DB RESTARTED & READY");
    } catch (e) { console.error("DATABASE START ERROR:", e); }
}
startDB();

io.on('connection', (socket) => {
    socket.on('auth', (nick) => {
        socket.join(nick);
        console.log(nick + " вошел в сеть");
    });

    socket.on('get_contacts', async (myNick) => {
        try {
            const res = await db.query(`
                SELECT DISTINCT CASE WHEN sender = $1 THEN receiver ELSE sender END as contact
                FROM messages WHERE sender = $1 OR receiver = $1
            `, [myNick]);
            socket.emit('contacts_list', res.rows.map(r => r.contact));
        } catch(e) { console.log(e); }
    });

    socket.on('get_history', async ({ me, him }) => {
        try {
            const res = await db.query(`
                SELECT sender, txt FROM messages 
                WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
                ORDER BY ts ASC
            `, [me, him]);
            socket.emit('history', res.rows);
        } catch(e) { console.log(e); }
    });

    socket.on('send', async (data) => {
        try {
            await db.query("INSERT INTO messages (sender, receiver, txt) VALUES ($1, $2, $3)", 
            [data.from, data.to, data.msg]);
            io.to(data.from).to(data.to).emit('new_msg', data);
        } catch(e) { console.log(e); }
    });
});

server.listen(process.env.PORT || 10000, '0.0.0.0');
