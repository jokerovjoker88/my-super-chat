const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "User";
localStorage.setItem('chat_name', myName);

let currentRoom = null;

document.getElementById('user-name').innerText = myName;
document.getElementById('user-avatar').innerText = myName[0].toUpperCase();

// 1. Запрос моих чатов
socket.emit('get my rooms', myName);

socket.on('rooms list', rooms => {
    const box = document.getElementById('rooms-box');
    box.innerHTML = '';
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = `room-item ${currentRoom === room ? 'active' : ''}`;
        div.innerText = room;
        div.onclick = () => switchRoom(room);
        box.appendChild(div);
    });
});

function createRoom() {
    const name = prompt("Название нового чата:");
    if (name) socket.emit('create room', { room: name, creator: myName });
}

socket.on('room created', room => {
    socket.emit('get my rooms', myName);
    switchRoom(room);
});

function inviteUser() {
    const target = prompt("Ник пользователя, которого хотите добавить:");
    if (target) {
        socket.emit('invite user', { room: currentRoom, targetUser: target });
        alert(`Запрос отправлен пользователю ${target}`);
    }
}

socket.on('new invite', data => {
    if (data.targetUser === myName) {
        alert(`Вас добавили в чат: ${data.room}`);
        socket.emit('get my rooms', myName);
    }
});

function switchRoom(room) {
    currentRoom = room;
    document.getElementById('room-title').innerText = room;
    document.getElementById('invite-btn').style.display = 'block';
    document.getElementById('input-footer').style.display = 'block';
    socket.emit('join room', { username: myName, room: room });
    if(window.innerWidth < 900) toggleMenu();
}

socket.on('load history', h => {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';
    h.forEach(renderMessage);
});

socket.on('chat message', m => { if(m.room === currentRoom) renderMessage(m); });

function renderMessage(data) {
    const isMine = data.username === myName;
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    wrap.innerHTML = `<div class="message"><strong>${data.username}</strong><br>${data.content}</div>`;
    document.getElementById('messages').appendChild(wrap);
    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
}

document.getElementById('send-btn').onclick = () => {
    const txt = document.getElementById('msg-input').value;
    if(txt.trim() && currentRoom) {
        socket.emit('chat message', { user: myName, text: txt, room: currentRoom });
        document.getElementById('msg-input').value = '';
    }
};

function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); }
