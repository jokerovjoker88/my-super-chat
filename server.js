const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function init() {
    try {
        await db.connect();
        // Всего одна таблица для всех сообщений
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender TEXT,
                receiver TEXT,
                txt TEXT,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("DB Ready");
    } catch (e) { console.log("DB Error", e); }
}
init();

app.use(express.static('public'));

io.on('connection', (socket) => {
    // Авторизация
    socket.on('auth', (nick) => {
        socket.join(nick);
        console.log(nick + " online");
    });

    // Получить список тех, с кем я уже переписывался
    socket.on('get_contacts', async (myNick) => {
        const res = await db.query(`
            SELECT DISTINCT CASE WHEN sender = $1 THEN receiver ELSE sender END as contact
            FROM messages WHERE sender = $1 OR receiver = $1
        `, [myNick]);
        socket.emit('contacts_list', res.rows.map(r => r.contact));
    });

    // Получить историю с конкретным человеком
    socket.on('get_history', async ({ me, him }) => {
        const res = await db.query(`
            SELECT sender, txt FROM messages 
            WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)
            ORDER BY ts ASC
        `, [me, him]);
        socket.emit('history', res.rows);
    });

    // Отправить сообщение
    socket.on('send', async (data) => {
        await db.query("INSERT INTO messages (sender, receiver, txt) VALUES ($1, $2, $3)", 
        [data.from, data.to, data.msg]);
        
        // Шлем обоим участникам
        io.to(data.from).to(data.to).emit('new_msg', data);
    });
});

server.listen(process.env.PORT || 10000);
