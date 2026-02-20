const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

let messages = [];
let onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username };
        socket.emit('load history', messages.slice(-50));
        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', (data) => {
        const msg = { 
            user: data.user, 
            text: data.text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };
        messages.push(msg);
        if (messages.length > 100) messages.shift();
        io.emit('chat message', msg);
    });

    // НОВОЕ: Передаем всем, что кто-то печатает
    socket.on('typing', (data) => {
        socket.broadcast.emit('user typing', { user: data.user });
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update online', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
