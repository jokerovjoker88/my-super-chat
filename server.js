const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // Инициализация Socket.io для сервера

// Указываем серверу, где лежат файлы сайта
app.use(express.static(path.join(__dirname, 'public')));

let messages = []; 
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('Кто-то подключился');

    socket.on('join', (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username };
        
        socket.emit('load history', messages.slice(-50));
        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', (data) => {
        const msg = { user: data.user, text: data.text, time: new Date().toLocaleTimeString() };
        messages.push(msg);
        if (messages.length > 100) messages.shift();
        io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(`✅ СЕРВЕР ЗАПУЩЕН!`);
    console.log(`🌐 Ссылка: http://localhost:${PORT}`);
    console.log(`======================================\n`);
});