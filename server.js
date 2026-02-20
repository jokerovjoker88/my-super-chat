const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let onlineUsers = {}; 

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        socket.username = data.username;
        onlineUsers[socket.id] = { name: data.username, room: 'general' };
        socket.join('general');
        io.emit('update online', Object.values(onlineUsers));
    });

    socket.on('chat message', (data) => {
        const msg = { 
            user: data.user, 
            text: data.text, 
            room: data.room || 'general',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };
        io.to(data.room || 'general').emit('chat message', msg);
    });

    socket.on('join room', (roomName) => {
        socket.leaveAll(); 
        socket.join(roomName);
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id].room = roomName;
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('user typing', { user: data.user });
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
